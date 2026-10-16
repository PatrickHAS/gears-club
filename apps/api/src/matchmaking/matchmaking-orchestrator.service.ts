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

    let creationAttempted = false;

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
      creationAttempted = true;

      const match = await this.matches.createMatch({
        playerProfileIds,
        region: selection.region,
        reservationId,
      });

      this.logger.log(
        `Partida ${match.id} criada na região ${selection.region}.`,
      );

      return match;
    } catch (error) {
      // Verifica se a partida foi criada antes da falha.

      if (!creationAttempted) {
        try {
          await this.queue.releaseReservation(userIds, reservationId);
        } catch (releaseError) {
          this.logger.error(
            'Falha ao liberar a reserva antes da criação da partida.',
            releaseError instanceof Error
              ? releaseError.stack
              : String(releaseError),
          );
        }

        throw error;
      }

      let existingMatch;

      try {
        existingMatch = await this.prisma.match.findUnique({
          where: { reservationId },
          include: { participants: true },
        });
      } catch (lookupError) {
        // Não é seguro liberar a reserva quando não conseguimos
        // confirmar se a partida existe no PostgreSQL.
        this.logger.error(
          `Não foi possível verificar a reserva ${reservationId}. ` +
            'Os jogadores serão mantidos reservados.',
          lookupError instanceof Error
            ? lookupError.stack
            : String(lookupError),
        );

        throw error;
      }

      if (existingMatch) {
        const expectedUserIds = new Set(userIds);

        const participantProfileIds = existingMatch.participants.map(
          (participant) => participant.playerProfileId,
        );

        const profiles = await this.prisma.playerProfile.findMany({
          where: {
            id: { in: participantProfileIds },
          },
          select: {
            id: true,
            userId: true,
          },
        });

        const recoveredUserIds = new Set(
          profiles.map((profile) => profile.userId),
        );

        const samePlayers =
          existingMatch.participants.length === 8 &&
          profiles.length === 8 &&
          recoveredUserIds.size === 8 &&
          userIds.every((userId) => recoveredUserIds.has(userId));

        const sameRegion = existingMatch.region === selection.region;

        if (!samePlayers || !sameRegion) {
          this.logger.error(
            `Partida ${existingMatch.id} incompatível com a reserva ${reservationId}.`,
          );

          // Não liberar a reserva automaticamente:
          // precisamos investigar a inconsistência.
          throw new Error(
            'A partida recuperada não corresponde à reserva original.',
          );
        }

        this.logger.warn(
          `Partida ${existingMatch.id} recuperada após falha de resposta.`,
        );

        return existingMatch;
      }

      // A consulta confirmou que a partida não existe.
      this.logger.error(
        `Não foi encontrada partida para a reserva ${reservationId},  ` +
          'mas a criação pode ainda estar em andamento. ' +
          'A reserva não será liberada automaticamente.',
      );

      throw error;
    }
  }
}
