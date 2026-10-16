import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  NotFoundException,
} from '@nestjs/common';

import { RedisService } from '../../redis/redis.service.js';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface QueueEntry {
  userId: string;
  joinedAt: string;
}

@Injectable()
export class MatchmakingQueueService {
  private readonly queuePrefix = 'matchmaking:queue:';
  private readonly queueIndexKey = 'matchmaking:queue:index';
  private readonly queueTtlSeconds = 120;

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  private getQueueKey(userId: string): string {
    return `${this.queuePrefix}${userId}`;
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

    redis.call(
      'ZADD',
      KEYS[2],
      tonumber(ARGV[3]),
      ARGV[4]
    )

    return 1
  `,
        {
          keys: [this.getQueueKey(userId), this.queueIndexKey],
          arguments: [
            JSON.stringify(entry),
            String(this.queueTtlSeconds),
            String(new Date(entry.joinedAt).getTime()),
            userId,
          ],
        },
      );

      if (result === 0) {
        throw new ConflictException('Você já está na fila de matchmaking.');
      }

      if (result === null) {
        throw new ConflictException('Você já está na fila de matchmaking.');
      }

      return entry;
    } catch (error) {
      if (error instanceof ConflictException) {
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
}
