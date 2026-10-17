import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { MatchStatus, MatchTeam, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';
import { calculateEloChanges } from './elo-calculator.js';
import { EvidenceStorageService } from './evidence-storage/evidence-storage.service.js';

export interface CreateMatchInput {
  playerProfileIds: string[];
  region: string;
  reservationId: string;
}

export interface ResolveDisputeInput {
  matchId: string;
  adminId: string;
  winnerTeam: MatchTeam;
  reason: string;
  evidenceIds: string[];
  gamertagsVerified: boolean;
}

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidenceStorage: EvidenceStorageService,
  ) {}

  async listPendingDisputes() {
    const matches = await this.prisma.match.findMany({
      where: {
        status: MatchStatus.DISPUTED,
      },
      select: {
        id: true,
        mode: true,
        region: true,
        status: true,
        createdAt: true,
        startedAt: true,
        updatedAt: true,
        _count: {
          select: {
            participants: true,
            resultReports: true,
            disputeEvidences: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: 50,
    });

    return matches.map((match) => ({
      id: match.id,
      mode: match.mode,
      region: match.region,
      status: match.status,
      createdAt: match.createdAt,
      startedAt: match.startedAt,
      updatedAt: match.updatedAt,
      participantsCount: match._count.participants,
      reportsCount: match._count.resultReports,
      evidencesCount: match._count.disputeEvidences,
    }));
  }

  async getDisputeReview(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        mode: true,
        region: true,
        status: true,
        createdAt: true,
        startedAt: true,
        participants: {
          select: {
            team: true,
            isCaptain: true,
            playerProfileId: true,
            playerProfile: {
              select: {
                gamertag: true,
                country: true,
              },
            },
          },
          orderBy: [{ team: 'asc' }, { createdAt: 'asc' }],
        },
        resultReports: {
          select: {
            id: true,
            captainId: true,
            winnerTeam: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        disputeEvidences: {
          select: {
            id: true,
            captainId: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!match) {
      throw new NotFoundException('Partida não encontrada.');
    }

    if (match.status !== MatchStatus.DISPUTED) {
      throw new ConflictException('A partida não possui uma disputa pendente.');
    }

    return {
      id: match.id,
      mode: match.mode,
      region: match.region,
      status: match.status,
      createdAt: match.createdAt,
      startedAt: match.startedAt,
      participants: match.participants.map((participant) => ({
        playerProfileId: participant.playerProfileId,
        gamertag: participant.playerProfile.gamertag,
        country: participant.playerProfile.country,
        team: participant.team,
        isCaptain: participant.isCaptain,
      })),
      resultReports: match.resultReports,
      disputeEvidences: match.disputeEvidences,
    };
  }

  async resolveDispute(input: ResolveDisputeInput) {
    const {
      matchId,
      adminId,
      winnerTeam,
      reason,
      evidenceIds,
      gamertagsVerified,
    } = input;

    if (!Object.values(MatchTeam).includes(winnerTeam)) {
      throw new BadRequestException('Time vencedor inválido.');
    }

    if (
      typeof reason !== 'string' ||
      reason.trim().length < 10 ||
      reason.trim().length > 2000
    ) {
      throw new BadRequestException(
        'A justificativa deve conter entre 10 e 2000 caracteres.',
      );
    }

    if (gamertagsVerified !== true) {
      throw new BadRequestException(
        'O administrador deve confirmar a conferência das oito gamertags.',
      );
    }

    if (
      !Array.isArray(evidenceIds) ||
      evidenceIds.length === 0 ||
      evidenceIds.some(
        (id) => typeof id !== 'string' || id.trim().length === 0,
      ) ||
      new Set(evidenceIds).size !== evidenceIds.length
    ) {
      throw new BadRequestException(
        'Informe os identificadores únicos das evidências analisadas.',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        // Serializa decisões concorrentes sobre a mesma partida.
        await tx.$queryRaw`
          SELECT id
          FROM "matches"
          WHERE id = ${matchId}
          FOR UPDATE
        `;

        const participantIds = await tx.matchParticipant.findMany({
          where: { matchId },
          select: { playerProfileId: true },
        });

        await this.lockPlayers(
          tx,
          participantIds.map((participant) => participant.playerProfileId),
        );

        const match = await tx.match.findUnique({
          where: { id: matchId },
          include: {
            participants: {
              include: {
                playerProfile: {
                  include: { rating: true },
                },
              },
            },
          },
        });

        if (!match) {
          throw new NotFoundException('Partida não encontrada.');
        }

        if (match.status !== MatchStatus.DISPUTED) {
          throw new ConflictException(
            'Esta partida não está aguardando resolução de disputa.',
          );
        }

        if (
          match.participants.length !== 8 ||
          match.participants.some(
            (participant) => !participant.playerProfile.gamertag?.trim(),
          )
        ) {
          throw new ConflictException(
            'A partida deve possuir oito jogadores com gamertags cadastradas.',
          );
        }

        const cogPlayers = match.participants.filter(
          (participant) => participant.team === MatchTeam.COG,
        );

        const locustPlayers = match.participants.filter(
          (participant) => participant.team === MatchTeam.LOCUST,
        );

        const uniquePlayerIds = new Set(
          match.participants.map((participant) => participant.playerProfileId),
        );

        const uniqueGamertags = new Set(
          match.participants.map((participant) =>
            participant.playerProfile.gamertag!.trim().toLowerCase(),
          ),
        );

        if (
          cogPlayers.length !== 4 ||
          locustPlayers.length !== 4 ||
          uniquePlayerIds.size !== 8 ||
          uniqueGamertags.size !== 8
        ) {
          throw new ConflictException(
            'A partida deve possuir quatro jogadores por equipe, sem duplicações.',
          );
        }

        const evidences = await tx.matchDisputeEvidence.findMany({
          where: {
            matchId,
            id: { in: evidenceIds },
          },
          select: { id: true },
        });

        if (evidences.length !== evidenceIds.length) {
          throw new BadRequestException(
            'Uma ou mais evidências não pertencem à partida.',
          );
        }

        const players = match.participants.map((participant) => ({
          playerProfileId: participant.playerProfileId,
          elo: participant.playerProfile.rating?.elo ?? 1000,
          team: participant.team,
        }));

        const changes = calculateEloChanges(players, winnerTeam);

        // A decisão e o ranking serão persistidos atomicamente.
        const resolution = await tx.matchDisputeResolution.create({
          data: {
            matchId,
            adminId,
            winnerTeam,
            reason: reason.trim(),
            evidenceIds,
            gamertagsVerified,
          },
        });

        for (const change of changes) {
          const participant = match.participants.find(
            (item) => item.playerProfileId === change.playerProfileId,
          );

          if (!participant) {
            throw new ConflictException('Jogador não encontrado na partida.');
          }

          const won = participant.team === winnerTeam;

          await tx.playerRating.upsert({
            where: { playerProfileId: change.playerProfileId },
            create: {
              playerProfileId: change.playerProfileId,
              elo: change.newElo,
              wins: won ? 1 : 0,
              losses: won ? 0 : 1,
              matches: 1,
            },
            update: {
              elo: {
                increment: change.newElo - change.previousElo,
              },
              wins: { increment: won ? 1 : 0 },
              losses: { increment: won ? 0 : 1 },
              matches: { increment: 1 },
            },
          });
        }

        await tx.match.update({
          where: { id: matchId },
          data: {
            status: MatchStatus.COMPLETED,
            completedAt: new Date(),
          },
        });

        return resolution;
      },
      {
        maxWait: 10000,
        timeout: 30000,
      },
    );
  }

  async assertCanSubmitDisputeEvidence(
    matchId: string,
    userId: string,
  ): Promise<void> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
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
          take: 1,
        },
      },
    });

    if (!match) {
      throw new NotFoundException('Partida não encontrada.');
    }

    if (match.participants.length === 0) {
      throw new ForbiddenException(
        'Somente os capitães podem enviar evidências.',
      );
    }

    if (match.status !== MatchStatus.DISPUTED) {
      throw new ConflictException('A partida não está em disputa.');
    }
  }

  async getDisputeEvidenceImage(
    matchId: string,
    evidenceId: string,
    userId: string,
    isAdmin = false,
  ): Promise<Buffer> {
    const evidence = await this.prisma.matchDisputeEvidence.findFirst({
      where: {
        id: evidenceId,
        matchId,
      },
      select: {
        imageKey: true,
      },
    });

    if (!evidence) {
      throw new NotFoundException('Evidência não encontrada.');
    }

    if (!isAdmin) {
      const participant = await this.prisma.matchParticipant.findFirst({
        where: {
          matchId,
          playerProfile: {
            userId,
          },
        },
        select: {
          id: true,
        },
      });

      if (!participant) {
        throw new ForbiddenException(
          'Você não tem permissão para visualizar esta evidência.',
        );
      }
    }

    return this.evidenceStorage.read(evidence.imageKey);
  }

  async uploadDisputeEvidence(matchId: string, userId: string, file: Buffer) {
    // Impede o processamento de arquivos enviados
    // por jogadores sem autorização.
    await this.assertCanSubmitDisputeEvidence(matchId, userId);

    // O serviço valida, normaliza e salva a imagem.
    const imageKey = await this.evidenceStorage.save(file);

    try {
      // Revalida as permissões dentro da transação.
      return await this.submitDisputeEvidence(matchId, userId, imageKey);
    } catch (error) {
      // Evita deixar arquivos órfãos quando
      // o registro no banco de dados falha.
      try {
        await this.evidenceStorage.remove(imageKey);
      } catch {
        // Preserva o erro original do banco.
        // Uma falha na limpeza precisará ser registrada
        // e tratada por uma rotina de reconciliação.
      }

      throw error;
    }
  }

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

  async submitDisputeEvidence(
    matchId: string,
    userId: string,
    imageKey: string,
  ) {
    if (
      typeof imageKey !== 'string' ||
      !imageKey.trim() ||
      imageKey.length > 512
    ) {
      throw new BadRequestException('A referência da imagem é inválida.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Serializa operações concorrentes na mesma partida.
      await tx.$queryRaw`
      SELECT id
      FROM "matches"
      WHERE id = ${matchId}
      FOR UPDATE
    `;

      const match = await tx.match.findUnique({
        where: { id: matchId },
        select: {
          status: true,
          participants: {
            where: {
              isCaptain: true,
              playerProfile: { userId },
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
          'Somente os capitães podem enviar evidências.',
        );
      }

      if (match.status !== MatchStatus.DISPUTED) {
        throw new ConflictException('A partida não está em disputa.');
      }

      const captainId = match.participants[0].playerProfileId;

      return tx.matchDisputeEvidence.create({
        data: {
          matchId,
          captainId,
          imageKey: imageKey.trim(),
        },
      });
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

      const report = await tx.matchResultReport.create({
        data: {
          matchId,
          captainId,
          winnerTeam,
        },
      });

      // Busca os reportes após registrar o resultado atual.
      const reports = await tx.matchResultReport.findMany({
        where: { matchId },
        select: {
          captainId: true,
          winnerTeam: true,
        },
      });

      // Aguarda os dois capitães.
      if (reports.length === 2) {
        const sameWinner = reports[0].winnerTeam === reports[1].winnerTeam;

        await tx.match.update({
          where: { id: matchId },
          data: {
            status: sameWinner
              ? MatchStatus.AWAITING_VALIDATION
              : MatchStatus.DISPUTED,
          },
        });
      }

      return report;
    });
  }

  async validateMatchResult(matchId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        // Impede duas homologações simultâneas da mesma partida.
        await tx.$queryRaw`
        SELECT id
        FROM "matches"
        WHERE id = ${matchId}
        FOR UPDATE
      `;

        const participantIds = await tx.matchParticipant.findMany({
          where: { matchId },
          select: { playerProfileId: true },
        });

        // Bloqueia os jogadores em ordem fixa para evitar deadlocks.
        await this.lockPlayers(
          tx,
          participantIds.map((participant) => participant.playerProfileId),
        );

        const match = await tx.match.findUnique({
          where: { id: matchId },
          include: {
            participants: {
              include: {
                playerProfile: {
                  include: { rating: true },
                },
              },
            },
            resultReports: true,
          },
        });

        if (!match) {
          throw new NotFoundException('Partida não encontrada.');
        }

        if (match.status !== MatchStatus.AWAITING_VALIDATION) {
          throw new ConflictException(
            'Esta partida não está aguardando homologação.',
          );
        }

        if (
          match.resultReports.length !== 2 ||
          match.resultReports[0].winnerTeam !==
            match.resultReports[1].winnerTeam
        ) {
          throw new ConflictException(
            'Os resultados dos capitães não estão confirmados.',
          );
        }

        const winnerTeam = match.resultReports[0].winnerTeam;

        const players = match.participants.map((participant) => ({
          playerProfileId: participant.playerProfileId,
          elo: participant.playerProfile.rating?.elo ?? 1000,
          team: participant.team,
        }));

        const changes = calculateEloChanges(players, winnerTeam);

        for (const change of changes) {
          const participant = match.participants.find(
            (item) => item.playerProfileId === change.playerProfileId,
          );

          if (!participant) {
            throw new ConflictException('Jogador não encontrado na partida.');
          }

          const won = participant.team === winnerTeam;

          await tx.playerRating.upsert({
            where: { playerProfileId: change.playerProfileId },
            create: {
              playerProfileId: change.playerProfileId,
              elo: change.newElo,
              wins: won ? 1 : 0,
              losses: won ? 0 : 1,
              matches: 1,
            },
            update: {
              elo: { increment: change.newElo - change.previousElo },
              wins: { increment: won ? 1 : 0 },
              losses: { increment: won ? 0 : 1 },
              matches: { increment: 1 },
            },
          });
        }

        return tx.match.update({
          where: { id: matchId },
          data: {
            status: MatchStatus.COMPLETED,
            completedAt: new Date(),
          },
        });
      },
      {
        maxWait: 10000,
        timeout: 30000,
      },
    );
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
                in: [
                  MatchStatus.PENDING,
                  MatchStatus.IN_PROGRESS,
                  MatchStatus.AWAITING_VALIDATION,
                  MatchStatus.DISPUTED,
                ],
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
