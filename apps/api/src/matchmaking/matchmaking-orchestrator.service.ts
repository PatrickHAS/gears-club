import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service.js';
import { MatchesService } from '../matches/matches.service.js';
import { MatchmakingQueueService } from './matchmaking-queue/matchmaking-queue.service.js';

@Injectable()
export class MatchmakingOrchestratorService {
  private readonly logger = new Logger(MatchmakingOrchestratorService.name);

  constructor(
    private readonly queue: MatchmakingQueueService,
    private readonly matches: MatchesService,
    private readonly prisma: PrismaService,
  ) {}

  async createMatchFromQueue() {
    // 1. Encontrar oito jogadores compatíveis.
    const selection = await this.queue.findMatch();

    if (!selection) {
      return null;
    }

    const userIds = selection.players.map((player) => player.userId);

    const reservationId = randomUUID();

    // 2. Reservar os oito jogadores no Redis.
    const reserved = await this.queue.reservePlayers(userIds, reservationId);

    // Outra operação pode ter reservado os jogadores.
    if (!reserved) {
      return null;
    }

    try {
      // 3. Buscar os perfis correspondentes.
      const profiles = await this.prisma.playerProfile.findMany({
        where: {
          userId: {
            in: userIds,
          },
        },
        select: {
          id: true,
          userId: true,
        },
      });

      if (profiles.length !== 8) {
        throw new Error('Não foi possível encontrar os oito perfis.');
      }

      const profilesByUserId = new Map(
        profiles.map((profile) => [profile.userId, profile.id]),
      );

      // Mantém a ordem original dos jogadores selecionados.
      const playerProfileIds = userIds.map((userId) => {
        const profileId = profilesByUserId.get(userId);

        if (!profileId) {
          throw new Error(`Perfil não encontrado para o jogador ${userId}.`);
        }

        return profileId;
      });

      // 4. Criar a partida no PostgreSQL.
      const match = await this.matches.createMatch({
        playerProfileIds,
        region: selection.region,
      });

      this.logger.log(
        `Partida ${match.id} criada na região ${selection.region}.`,
      );

      return match;
    } catch (error) {
      // 5. Liberar a reserva caso a criação falhe.
      try {
        await this.queue.releaseReservation(userIds, reservationId);
      } catch (releaseError) {
        this.logger.error(
          'Falha ao liberar a reserva após erro na criação da partida.',
          releaseError instanceof Error
            ? releaseError.stack
            : String(releaseError),
        );
      }

      throw error;
    }
  }
}
