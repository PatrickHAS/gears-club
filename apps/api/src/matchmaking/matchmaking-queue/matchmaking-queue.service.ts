import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  NotFoundException,
} from '@nestjs/common';

import {
  selectMatchmakingPlayers,
  type MatchmakingSelection,
} from './matchmaking-selector.js';

import { RedisService } from '../../redis/redis.service.js';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface QueueEntry {
  userId: string;
  joinedAt: string;
}

export interface MatchmakingCandidate {
  userId: string;
  joinedAt: string;
  gamertag: string;
  country: string;
  elo: number;
  acceptedCountries: string[];
}

@Injectable()
export class MatchmakingQueueService {
  private readonly queuePrefix = 'matchmaking:queue:';
  private readonly queueIndexKey = 'matchmaking:queue:index';
  private readonly queueTtlSeconds = 120;
  private readonly reservationTtlSeconds = 120;

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  private getQueueKey(userId: string): string {
    return `${this.queuePrefix}${userId}`;
  }

  private getPlayerReservationKey(userId: string): string {
    return `matchmaking:player:reservation:${userId}`;
  }

  private async validatePlayerProfile(userId: string): Promise<void> {
    const profile = await this.prisma.playerProfile.findUnique({
      where: { userId },
      select: {
        gamertag: true,
        country: true,
      },
    });

    if (!profile?.gamertag?.trim() || !profile.country) {
      throw new BadRequestException(
        'Defina sua gamertag e seu país no perfil antes de entrar na fila.',
      );
    }
  }

  async join(userId: string): Promise<QueueEntry> {
    await this.validatePlayerProfile(userId);

    const entry: QueueEntry = {
      userId,
      joinedAt: new Date().toISOString(),
    };

    try {
      const result = await this.redis.getClient().eval(
        `
        -- Impede a entrada de jogadores reservados.
        if redis.call('EXISTS', KEYS[3]) == 1 then
          return 2
        end

        -- Inscreve o jogador apenas se ainda não estiver na fila.
        local created = redis.call(
          'SET',
          KEYS[1],
          ARGV[1],
          'NX',
          'EX',
          tonumber(ARGV[2])
        )

        if not created then
          return 0
        end

        -- Adiciona o jogador ao índice ordenado.
        redis.call(
          'ZADD',
          KEYS[2],
          tonumber(ARGV[3]),
          ARGV[4]
        )

        return 1
      `,
        {
          keys: [
            this.getQueueKey(userId),
            this.queueIndexKey,
            this.getPlayerReservationKey(userId),
          ],
          arguments: [
            JSON.stringify(entry),
            String(this.queueTtlSeconds),
            String(new Date(entry.joinedAt).getTime()),
            userId,
          ],
        },
      );

      if (result === 2) {
        throw new ConflictException(
          'Você já possui uma reserva ativa de matchmaking.',
        );
      }

      if (result === 0) {
        throw new ConflictException('Você já está na fila de matchmaking.');
      }

      if (result !== 1) {
        throw new ServiceUnavailableException(
          'Resposta inesperada do serviço de matchmaking.',
        );
      }

      return entry;
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      throw new ServiceUnavailableException(
        'Não foi possível entrar na fila de matchmaking.',
      );
    }
  }

  async getStatus(userId: string): Promise<QueueEntry | null> {
    try {
      const value = await this.redis.getClient().get(this.getQueueKey(userId));

      return value ? (JSON.parse(value) as QueueEntry) : null;
    } catch {
      throw new ServiceUnavailableException(
        'Não foi possível consultar a fila de matchmaking.',
      );
    }
  }

  async heartbeat(userId: string): Promise<{ renewed: boolean }> {
    try {
      const renewed = await this.redis
        .getClient()
        .expire(this.getQueueKey(userId), this.queueTtlSeconds, 'XX');

      if (!renewed) {
        throw new NotFoundException('Você não está na fila de matchmaking.');
      }

      return { renewed: true };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new ServiceUnavailableException(
        'Não foi possível renovar sua inscrição na fila.',
      );
    }
  }

  async leave(userId: string): Promise<{ removed: boolean }> {
    try {
      const deleted = await this.redis.getClient().eval(
        `
        local removed = redis.call('DEL', KEYS[1])

        redis.call('ZREM', KEYS[2], ARGV[1])

        return removed
      `,
        {
          keys: [this.getQueueKey(userId), this.queueIndexKey],
          arguments: [userId],
        },
      );

      return {
        removed: deleted === 1,
      };
    } catch {
      throw new ServiceUnavailableException(
        'Não foi possível sair da fila de matchmaking.',
      );
    }
  }

  async getActiveQueue(): Promise<QueueEntry[]> {
    try {
      const client = this.redis.getClient();

      const result = await client.eval(
        `
        local userIds = redis.call('ZRANGE', KEYS[1], 0, -1)
        local entries = {}

        for _, userId in ipairs(userIds) do
          local value = redis.call(
            'GET',
            ARGV[1] .. userId
          )

          if value then
            table.insert(entries, value)
          else
            redis.call('ZREM', KEYS[1], userId)
          end
        end

        return entries
      `,
        {
          keys: [this.queueIndexKey],
          arguments: [this.queuePrefix],
        },
      );

      return (result as string[]).map(
        (value) => JSON.parse(value) as QueueEntry,
      );
    } catch {
      throw new ServiceUnavailableException(
        'Não foi possível consultar os jogadores ativos na fila.',
      );
    }
  }

  async getCandidates(): Promise<MatchmakingCandidate[]> {
    const activeQueue = await this.getActiveQueue();

    if (activeQueue.length === 0) {
      return [];
    }

    const profiles = await this.prisma.playerProfile.findMany({
      where: {
        userId: {
          in: activeQueue.map((entry) => entry.userId),
        },
      },
      select: {
        userId: true,
        gamertag: true,
        country: true,
        rating: {
          select: {
            elo: true,
          },
        },
        matchmakingRegions: {
          select: {
            country: true,
          },
        },
      },
    });

    const profilesByUserId = new Map(
      profiles.map((profile) => [profile.userId, profile]),
    );

    const candidates: MatchmakingCandidate[] = [];

    for (const entry of activeQueue) {
      const profile = profilesByUserId.get(entry.userId);

      if (!profile?.gamertag || !profile.country) {
        continue;
      }

      const acceptedCountries = [
        ...new Set([
          profile.country,
          ...profile.matchmakingRegions.map((region) => region.country),
        ]),
      ].sort();

      candidates.push({
        userId: entry.userId,
        joinedAt: entry.joinedAt,
        gamertag: profile.gamertag,
        country: profile.country,
        elo: profile.rating?.elo ?? 1000,
        acceptedCountries,
      });
    }

    return candidates;
  }

  async findMatch(): Promise<MatchmakingSelection | null> {
    const candidates = await this.getCandidates();

    if (candidates.length < 8) {
      return null;
    }

    return selectMatchmakingPlayers(candidates);
  }

  async reservePlayers(
    userIds: string[],
    reservationId: string,
  ): Promise<boolean> {
    if (
      userIds.length !== 8 ||
      new Set(userIds).size !== 8 ||
      userIds.some((id) => !id.trim()) ||
      !reservationId.trim()
    ) {
      throw new BadRequestException(
        'A reserva exige 8 jogadores distintos e um identificador válido.',
      );
    }

    const reservationKey = `matchmaking:reservation:${reservationId}`;

    const playerReservationKeys = userIds.map(
      (userId) => `matchmaking:player:reservation:${userId}`,
    );

    try {
      const result = await this.redis.getClient().eval(
        `
        -- KEYS[1]: reserva
        -- KEYS[2]: indice da fila
        -- KEYS[3..10]: inscricoes dos jogadores
        -- KEYS[11..18]: bloqueios individuais

        if redis.call('EXISTS', KEYS[1]) == 1 then
          return 0
        end

        -- Todos precisam continuar na fila.
        for i = 3, 10 do
          if redis.call('EXISTS', KEYS[i]) == 0 then
            return 0
          end
        end

        -- Nenhum jogador pode estar reservado.
        for i = 11, 18 do
          if redis.call('EXISTS', KEYS[i]) == 1 then
            return 0
          end
        end

        -- Cria a reserva principal.
        redis.call(
          'SET',
          KEYS[1],
          cjson.encode({
            userIds = {
              ARGV[2], ARGV[3], ARGV[4], ARGV[5],
              ARGV[6], ARGV[7], ARGV[8], ARGV[9]
            }
          }),
          'EX',
          tonumber(ARGV[1])
        )

        -- Bloqueia individualmente os oito jogadores.
        for i = 11, 18 do
          redis.call(
            'SET',
            KEYS[i],
            ARGV[10],
            'EX',
            tonumber(ARGV[1])
          )
        end

        -- Remove os jogadores da fila.
        for i = 3, 10 do
          redis.call('DEL', KEYS[i])
          redis.call('ZREM', KEYS[2], ARGV[i - 1])
        end

        return 1
      `,
        {
          keys: [
            reservationKey,
            this.queueIndexKey,
            ...userIds.map((id) => this.getQueueKey(id)),
            ...playerReservationKeys,
          ],
          arguments: [
            String(this.reservationTtlSeconds),
            ...userIds,
            reservationId,
          ],
        },
      );

      return result === 1;
    } catch {
      throw new ServiceUnavailableException(
        'Não foi possível reservar os jogadores.',
      );
    }
  }

  async releaseReservation(
    userIds: string[],
    reservationId: string,
  ): Promise<boolean> {
    if (
      userIds.length !== 8 ||
      new Set(userIds).size !== 8 ||
      userIds.some((id) => !id.trim()) ||
      !reservationId.trim()
    ) {
      throw new BadRequestException(
        'A liberação exige 8 jogadores distintos e uma reserva válida.',
      );
    }

    const reservationKey = `matchmaking:reservation:${reservationId}`;

    const playerReservationKeys = userIds.map((userId) =>
      this.getPlayerReservationKey(userId),
    );

    try {
      const result = await this.redis.getClient().eval(
        `
          -- Confirma que a reserva principal existe.
          local reservationData = redis.call('GET', KEYS[1])
          if not reservationData then
            return 0
          end
          -- Confirma que os oito jogadores pertencem à reserva.
          local reservation = cjson.decode(reservationData)
          if type(reservation.userIds) ~= 'table'
            or #reservation.userIds ~= 8 then
            return 0
          end
          local expectedPlayers = {}
          -- Registra os jogadores da reserva.
          for _, userId in ipairs(reservation.userIds) do
            if expectedPlayers[userId] then
              return 0
            end
            expectedPlayers[userId] = true
          end
          -- Confirma que os jogadores recebidos são os mesmos.
          for i = 2, 9 do
            local userId = ARGV[i]
            if not expectedPlayers[userId] then
              return 0
            end
            expectedPlayers[userId] = nil
          end
          -- Confirma que todos os bloqueios pertencem à reserva.
          for i = 2, 9 do
            if redis.call('GET', KEYS[i]) ~= ARGV[1] then
              return 0
            end
          end
          -- Remove os oito bloqueios individuais.
          for i = 2, 9 do
            redis.call('DEL', KEYS[i])
          end
          -- Remove a reserva principal.
          redis.call('DEL', KEYS[1])
          return 1
      `,
        {
          keys: [reservationKey, ...playerReservationKeys],
          arguments: [reservationId, ...userIds],
        },
      );

      return result === 1;
    } catch {
      throw new ServiceUnavailableException(
        'Não foi possível liberar a reserva de matchmaking.',
      );
    }
  }
}
