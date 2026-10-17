import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { MatchStatus, MatchTeam, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';

export interface CreateMatchInput {
  playerProfileIds: string[];
  region: string;
  reservationId: string;
}

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMatchById(matchId: string, userId: string) {
    const match = await this.prisma.match.findUnique({
      where: {
        id: matchId,
      },
      include: {
        participants: {
          include: {
            playerProfile: {
              select: {
                id: true,
                userId: true,
                gamertag: true,
                country: true,
              },
            },
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundException('Partida não encontrada.');
    }

    const isParticipant = match.participants.some(
      (participant) => participant.playerProfile.userId === userId,
    );

    if (!isParticipant) {
      throw new ForbiddenException(
        'Você não possui permissão para visualizar esta partida.',
      );
    }

    return match;
  }

  async startMatch(matchId: string, userId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        status: true,
        participants: {
          where: {
            isCaptain: true,
            playerProfile: {
              userId,
            },
          },
          select: {
            id: true,
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundException('Partida não encontrada.');
    }

    if (match.participants.length === 0) {
      throw new ForbiddenException(
        'Somente os capitães podem iniciar a partida.',
      );
    }

    if (match.status !== 'PENDING') {
      throw new ConflictException('Esta partida não está aguardando início.');
    }

    const result = await this.prisma.match.updateMany({
      where: {
        id: matchId,
        status: 'PENDING',
      },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    if (result.count !== 1) {
      throw new ConflictException('Esta partida já foi iniciada ou alterada.');
    }

    return this.prisma.match.findUniqueOrThrow({
      where: { id: matchId },
      include: {
        participants: true,
      },
    });
  }

  async reportResult(matchId: string, userId: string, winnerTeam: MatchTeam) {
    if (winnerTeam !== MatchTeam.COG && winnerTeam !== MatchTeam.LOCUST) {
      throw new BadRequestException('O vencedor deve ser COG ou LOCUST.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Serializa reportes concorrentes da mesma partida.
      await tx.$queryRaw`
      SELECT id
      FROM "matches"
      WHERE id = ${matchId}
      FOR UPDATE
    `;

      const match = await tx.match.findUnique({
        where: { id: matchId },
        select: {
          id: true,
          status: true,
          participants: {
            where: {
              isCaptain: true,
              playerProfile: {
                userId,
              },
            },
            select: {
              playerProfileId: true,
            },
          },
        },
      });

      if (!match) {
        throw new NotFoundException('Partida não encontrada.');
      }

      if (match.participants.length === 0) {
        throw new ForbiddenException(
          'Somente os capitães podem reportar resultados.',
        );
      }

      if (match.status !== MatchStatus.IN_PROGRESS) {
        throw new ConflictException('A partida não está em andamento.');
      }

      const captainId = match.participants[0].playerProfileId;

      const existingReport = await tx.matchResultReport.findUnique({
        where: {
          matchId_captainId: {
            matchId,
            captainId,
          },
        },
      });

      if (existingReport) {
        throw new ConflictException(
          'Você já reportou o resultado desta partida.',
        );
      }

      return tx.matchResultReport.create({
        data: {
          matchId,
          captainId,
          winnerTeam,
        },
      });
    });
  }

  private async lockPlayers(
    tx: Prisma.TransactionClient,
    playerProfileIds: string[],
  ): Promise<void> {
    // A ordem fixa evita deadlocks entre partidas concorrentes.
    const sortedIds = [...playerProfileIds].sort();

    for (const playerProfileId of sortedIds) {
      await tx.$queryRaw`
        SELECT 1 AS locked
        FROM (
          SELECT pg_advisory_xact_lock(
            hashtextextended(${playerProfileId}, 0)
          )
        ) AS player_lock
      `;
    }
  }

  async createMatch(input: CreateMatchInput) {
    const { playerProfileIds, region, reservationId } = input;

    if (playerProfileIds.length !== 8) {
      throw new BadRequestException(
        'Uma partida 4v4 precisa de exatamente 8 jogadores.',
      );
    }

    if (new Set(playerProfileIds).size !== 8) {
      throw new BadRequestException(
        'Uma partida não pode conter jogadores duplicados.',
      );
    }

    if (!/^[A-Z]{2}$/.test(region)) {
      throw new BadRequestException('A região da partida é inválida.');
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(reservationId)) {
      throw new BadRequestException('O identificador da reserva é inválido.');
    }

    const existingMatch = await this.prisma.match.findUnique({
      where: { reservationId },
      include: { participants: true },
    });

    if (existingMatch) {
      this.validateExistingMatch(existingMatch, playerProfileIds, region);

      return existingMatch;
    }

    const profiles = await this.prisma.playerProfile.findMany({
      where: {
        id: { in: playerProfileIds },
      },
      select: { id: true },
    });

    if (profiles.length !== 8) {
      throw new BadRequestException(
        'Um ou mais jogadores não possuem perfil válido.',
      );
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // Bloqueia os oito jogadores durante a transação.
          await this.lockPlayers(tx, playerProfileIds);

          // Verifica novamente a reserva após adquirir os bloqueios.
          const matchByReservation = await tx.match.findUnique({
            where: { reservationId },
            include: { participants: true },
          });

          if (matchByReservation) {
            this.validateExistingMatch(
              matchByReservation,
              playerProfileIds,
              region,
            );

            return matchByReservation;
          }

          // Impede jogadores de participarem de duas partidas ativas.
          const activeMatch = await tx.match.findFirst({
            where: {
              status: {
                in: ['PENDING', 'IN_PROGRESS', 'DISPUTED'],
              },
              participants: {
                some: {
                  playerProfileId: {
                    in: playerProfileIds,
                  },
                },
              },
            },
            select: { id: true },
          });

          if (activeMatch) {
            throw new BadRequestException(
              'Um ou mais jogadores já possuem uma partida ativa.',
            );
          }

          return tx.match.create({
            data: {
              reservationId,
              mode: 'DEMOLITION',
              region,
              participants: {
                create: playerProfileIds.map((playerProfileId, index) => ({
                  playerProfileId,
                  team: index < 4 ? MatchTeam.COG : MatchTeam.LOCUST,
                  isCaptain: index === 0 || index === 4,
                })),
              },
            },
            include: { participants: true },
          });
        },
        {
          maxWait: 10000,
          timeout: 30000,
        },
      );
    } catch (error) {
      // Preserva a recuperação idempotente por reservationId.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const match = await this.prisma.match.findUnique({
          where: { reservationId },
          include: { participants: true },
        });

        if (match) {
          this.validateExistingMatch(match, playerProfileIds, region);

          return match;
        }
      }

      throw error;
    }
  }

  private validateExistingMatch(
    match: {
      region: string;
      participants: {
        playerProfileId: string;
        team: MatchTeam;
      }[];
    },
    playerProfileIds: string[],
    region: string,
  ): void {
    if (match.region !== region) {
      throw new BadRequestException(
        'Esta reserva já pertence a uma partida de outra região.',
      );
    }

    const existingPlayerIds = new Set(
      match.participants.map((participant) => participant.playerProfileId),
    );

    const samePlayers =
      existingPlayerIds.size === 8 &&
      playerProfileIds.length === 8 &&
      playerProfileIds.every((id) => existingPlayerIds.has(id));

    if (!samePlayers) {
      throw new BadRequestException(
        'Esta reserva já pertence a uma partida com jogadores diferentes.',
      );
    }

    const cogCount = match.participants.filter(
      (participant) => participant.team === MatchTeam.COG,
    ).length;

    const locustCount = match.participants.filter(
      (participant) => participant.team === MatchTeam.LOCUST,
    ).length;

    if (cogCount !== 4 || locustCount !== 4) {
      throw new BadRequestException(
        'A partida existente possui equipes inválidas.',
      );
    }
  }
}
