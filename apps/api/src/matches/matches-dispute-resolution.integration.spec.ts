import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { MatchTeam } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { MatchesService } from './matches.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EvidenceStorageService } from './evidence-storage/evidence-storage.service.js';
import { calculateEloChanges } from './elo-calculator.js';

describe('MatchesService - resolução administrativa de disputas', () => {
  const prisma = new PrismaService();
  const evidenceStorage = new EvidenceStorageService();
  const service = new MatchesService(prisma, evidenceStorage);

  const userIds: string[] = [];
  const profileIds: string[] = [];
  const reservationId = randomUUID();

  let matchId: string;
  let adminId: string;
  let evidenceId: string;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl || new URL(databaseUrl).pathname !== '/gears_club_test') {
      throw new Error(
        'Teste bloqueado: DATABASE_URL deve apontar para gears_club_test.',
      );
    }

    await prisma.$connect();

    const testId = randomUUID().slice(0, 8);

    for (let index = 0; index < 8; index++) {
      const user = await prisma.user.create({
        data: {
          username: `dispute_${testId}_${index}`,
          email: `dispute_${testId}_${index}@example.test`,
          passwordHash: 'test-only-not-a-real-password',
          profile: {
            create: {
              country: 'BR',
              gamertag: `Dispute${testId}${index}`,
            },
          },
        },
        include: { profile: true },
      });

      if (!user.profile) {
        throw new Error('Perfil temporário não foi criado.');
      }

      userIds.push(user.id);
      profileIds.push(user.profile.id);
    }

    const admin = await prisma.user.create({
      data: {
        username: `admin_${testId}`,
        email: `admin_${testId}@example.test`,
        passwordHash: 'test-only-not-a-real-password',
        role: 'ADMIN',
      },
    });

    adminId = admin.id;
    userIds.push(admin.id);

    const match = await service.createMatch({
      playerProfileIds: profileIds,
      region: 'BR',
      reservationId,
    });

    matchId = match.id;

    await service.startMatch(matchId, userIds[0]);
    await service.reportResult(matchId, userIds[0], MatchTeam.COG);
    await service.reportResult(matchId, userIds[4], MatchTeam.LOCUST);

    const evidence = await prisma.matchDisputeEvidence.create({
      data: {
        matchId,
        captainId: profileIds[0],
        imageKey: `${randomUUID()}.png`,
      },
    });

    evidenceId = evidence.id;
  });

  afterAll(async () => {
    try {
      if (matchId) {
        await prisma.matchDisputeResolution.deleteMany({
          where: { matchId },
        });

        await prisma.match.deleteMany({
          where: { id: matchId },
        });
      }

      if (userIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: userIds } },
        });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it('deve resolver a disputa e atualizar os oito rankings', async () => {
    const review = await service.getDisputeReview(matchId);

    expect(review.id).toBe(matchId);
    expect(review.status).toBe('DISPUTED');

    expect(review.participants).toHaveLength(8);
    expect(
      review.participants.filter((p) => p.team === MatchTeam.COG),
    ).toHaveLength(4);
    expect(
      review.participants.filter((p) => p.team === MatchTeam.LOCUST),
    ).toHaveLength(4);
    expect(review.participants.filter((p) => p.isCaptain)).toHaveLength(2);

    expect(review.resultReports).toHaveLength(2);
    expect(review.disputeEvidences).toHaveLength(1);
    expect(review.disputeEvidences[0].id).toBe(evidenceId);

    for (const participant of review.participants) {
      expect(participant.gamertag).toBeTruthy();
    }

    expect(JSON.stringify(review)).not.toContain('imageKey');

    const resolution = await service.resolveDispute({
      matchId,
      adminId,
      winnerTeam: MatchTeam.COG,
      reason: 'As oito gamertags foram conferidas nas evidências.',
      evidenceIds: [evidenceId],
      gamertagsVerified: true,
    });

    expect(resolution.matchId).toBe(matchId);
    expect(resolution.adminId).toBe(adminId);
    expect(resolution.winnerTeam).toBe(MatchTeam.COG);
    expect(resolution.evidenceIds).toEqual([evidenceId]);
    expect(resolution.gamertagsVerified).toBe(true);

    const match = await prisma.match.findUniqueOrThrow({
      where: { id: matchId },
    });

    expect(match.status).toBe('COMPLETED');
    expect(match.completedAt).toBeInstanceOf(Date);

    const ratings = await prisma.playerRating.findMany({
      where: {
        playerProfileId: { in: profileIds },
      },
    });

    expect(ratings).toHaveLength(8);

    for (const rating of ratings) {
      const won = profileIds.indexOf(rating.playerProfileId) < 4;

      expect(rating.elo).toBe(won ? 1016 : 984);
      expect(rating.wins).toBe(won ? 1 : 0);
      expect(rating.losses).toBe(won ? 0 : 1);
      expect(rating.matches).toBe(1);
    }
  });

  it('não deve permitir resolver a mesma disputa duas vezes', async () => {
    await expect(
      service.resolveDispute({
        matchId,
        adminId,
        winnerTeam: MatchTeam.LOCUST,
        reason: 'Tentativa de alterar uma decisão já concluída.',
        evidenceIds: [evidenceId],
        gamertagsVerified: true,
      }),
    ).rejects.toThrow(ConflictException);

    const resolutions = await prisma.matchDisputeResolution.findMany({
      where: { matchId },
    });

    expect(resolutions).toHaveLength(1);
    expect(resolutions[0].winnerTeam).toBe(MatchTeam.COG);

    const ratings = await prisma.playerRating.findMany({
      where: {
        playerProfileId: { in: profileIds },
      },
    });

    expect(ratings).toHaveLength(8);

    for (const rating of ratings) {
      const won = profileIds.indexOf(rating.playerProfileId) < 4;

      expect(rating.elo).toBe(won ? 1016 : 984);
      expect(rating.matches).toBe(1);
    }
  });

  it('deve reverter a decisão e os rankings quando uma atualização falha', async () => {
    const newReservationId = randomUUID();

    const match = await service.createMatch({
      playerProfileIds: profileIds,
      region: 'BR',
      reservationId: newReservationId,
    });

    try {
      await service.startMatch(match.id, userIds[0]);
      await service.reportResult(match.id, userIds[0], MatchTeam.COG);
      await service.reportResult(match.id, userIds[4], MatchTeam.LOCUST);

      const evidence = await prisma.matchDisputeEvidence.create({
        data: {
          matchId: match.id,
          captainId: profileIds[0],
          imageKey: `${randomUUID()}.png`,
        },
      });

      const before = await prisma.playerRating.findMany({
        where: { playerProfileId: { in: profileIds } },
      });

      const originalTransaction = prisma.$transaction.bind(prisma);

      const transactionSpy = vi
        .spyOn(prisma, '$transaction')
        .mockImplementationOnce(((callback: any, options: any) =>
          originalTransaction(async (tx) => {
            let updates = 0;

            const originalUpsert = tx.playerRating.upsert.bind(tx.playerRating);

            const txWithFailure = new Proxy(tx, {
              get(target, property) {
                if (property === 'playerRating') {
                  return new Proxy(target.playerRating, {
                    get(ratingTarget, ratingProperty) {
                      if (ratingProperty === 'upsert') {
                        return async (
                          ...args: Parameters<typeof originalUpsert>
                        ) => {
                          updates++;

                          if (updates === 5) {
                            throw new Error('Falha simulada no quinto jogador');
                          }

                          return originalUpsert(...args);
                        };
                      }

                      return Reflect.get(ratingTarget, ratingProperty);
                    },
                  });
                }

                return Reflect.get(target, property);
              },
            });

            return callback(txWithFailure);
          }, options)) as typeof prisma.$transaction);

      try {
        await expect(
          service.resolveDispute({
            matchId: match.id,
            adminId,
            winnerTeam: MatchTeam.COG,
            reason: 'Conferência administrativa das oito gamertags.',
            evidenceIds: [evidence.id],
            gamertagsVerified: true,
          }),
        ).rejects.toThrow('Falha simulada no quinto jogador');
      } finally {
        transactionSpy.mockRestore();
      }

      const after = await prisma.playerRating.findMany({
        where: { playerProfileId: { in: profileIds } },
      });

      const normalize = (ratings: typeof before) =>
        ratings
          .map(({ playerProfileId, elo, wins, losses, matches }) => ({
            playerProfileId,
            elo,
            wins,
            losses,
            matches,
          }))
          .sort((a, b) => a.playerProfileId.localeCompare(b.playerProfileId));

      expect(normalize(after)).toEqual(normalize(before));

      const updatedMatch = await prisma.match.findUniqueOrThrow({
        where: { id: match.id },
      });

      expect(updatedMatch.status).toBe('DISPUTED');
      expect(updatedMatch.completedAt).toBeNull();

      const resolutions = await prisma.matchDisputeResolution.findMany({
        where: { matchId: match.id },
      });

      expect(resolutions).toHaveLength(0);
    } finally {
      await prisma.matchDisputeResolution.deleteMany({
        where: { matchId: match.id },
      });

      await prisma.match.deleteMany({
        where: { reservationId: newReservationId },
      });
    }
  });

  it('deve permitir apenas uma resolução administrativa simultânea', async () => {
    const reservationId = randomUUID();

    const match = await service.createMatch({
      playerProfileIds: profileIds,
      region: 'BR',
      reservationId,
    });

    try {
      await service.startMatch(match.id, userIds[0]);
      await service.reportResult(match.id, userIds[0], MatchTeam.COG);
      await service.reportResult(match.id, userIds[4], MatchTeam.LOCUST);

      const evidence = await prisma.matchDisputeEvidence.create({
        data: {
          matchId: match.id,
          captainId: profileIds[0],
          imageKey: `${randomUUID()}.png`,
        },
      });

      const before = await prisma.playerRating.findMany({
        where: { playerProfileId: { in: profileIds } },
      });

      const expectedChanges = calculateEloChanges(
        profileIds.map((playerProfileId, index) => {
          const rating = before.find(
            (item) => item.playerProfileId === playerProfileId,
          );

          if (!rating) {
            throw new Error(`Ranking não encontrado: ${playerProfileId}`);
          }

          return {
            playerProfileId,
            elo: rating.elo,
            team: index < 4 ? MatchTeam.COG : MatchTeam.LOCUST,
          };
        }),
        MatchTeam.COG,
      );

      const input = {
        matchId: match.id,
        adminId,
        winnerTeam: MatchTeam.COG,
        reason: 'Verificação administrativa das oito gamertags.',
        evidenceIds: [evidence.id],
        gamertagsVerified: true,
      };

      const results = await Promise.allSettled([
        service.resolveDispute(input),
        service.resolveDispute(input),
      ]);

      const successful = results.filter(
        (result) => result.status === 'fulfilled',
      );

      const rejected = results.filter((result) => result.status === 'rejected');

      expect(successful).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const resolutions = await prisma.matchDisputeResolution.findMany({
        where: { matchId: match.id },
      });

      expect(resolutions).toHaveLength(1);

      const after = await prisma.playerRating.findMany({
        where: { playerProfileId: { in: profileIds } },
      });

      expect(after).toHaveLength(8);

      for (const rating of after) {
        const previous = before.find(
          (item) => item.playerProfileId === rating.playerProfileId,
        );

        expect(previous).toBeDefined();

        const expected = expectedChanges.find(
          (item) => item.playerProfileId === rating.playerProfileId,
        );

        expect(expected).toBeDefined();
        expect(rating.elo).toBe(expected!.newElo);
        expect(rating.matches).toBe(previous!.matches + 1);
      }

      const updatedMatch = await prisma.match.findUniqueOrThrow({
        where: { id: match.id },
      });

      expect(updatedMatch.status).toBe('COMPLETED');
    } finally {
      await prisma.matchDisputeResolution.deleteMany({
        where: { matchId: match.id },
      });

      await prisma.match.deleteMany({
        where: { reservationId },
      });
    }
  });

  it('deve rejeitar a revisão de uma partida inexistente', async () => {
    await expect(service.getDisputeReview(randomUUID())).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deve rejeitar a revisão de uma partida já concluída', async () => {
    await expect(service.getDisputeReview(matchId)).rejects.toThrow(
      ConflictException,
    );

    const match = await prisma.match.findUniqueOrThrow({
      where: { id: matchId },
    });

    expect(match.status).toBe('COMPLETED');
  });
});
