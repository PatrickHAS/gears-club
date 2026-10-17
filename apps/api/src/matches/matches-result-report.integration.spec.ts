import { randomUUID } from 'node:crypto';

import { ConflictException } from '@nestjs/common';
import { MatchTeam } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MatchesService } from './matches.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('MatchesService - concorrência dos reportes', () => {
  const prisma = new PrismaService();
  const service = new MatchesService(prisma);

  const userIds: string[] = [];
  const profileIds: string[] = [];

  const reservationId = randomUUID();

  let matchId: string;
  let captainUserId: string;
  let captainProfileId: string;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL não configurada.');
    }

    if (new URL(databaseUrl).pathname !== '/gears_club_test') {
      throw new Error(
        'Teste bloqueado: DATABASE_URL deve apontar para gears_club_test.',
      );
    }

    await prisma.$connect();

    const testId = randomUUID().slice(0, 8);

    for (let index = 0; index < 8; index++) {
      const user = await prisma.user.create({
        data: {
          username: `report_${testId}_${index}`,
          email: `report_${testId}_${index}@example.test`,
          passwordHash: 'test-only-not-a-real-password',
          profile: {
            create: {
              country: 'BR',
            },
          },
        },
        include: {
          profile: true,
        },
      });

      if (!user.profile) {
        throw new Error('Perfil temporário não foi criado.');
      }

      userIds.push(user.id);
      profileIds.push(user.profile.id);
    }

    captainUserId = userIds[0];
    captainProfileId = profileIds[0];

    const match = await service.createMatch({
      playerProfileIds: profileIds,
      region: 'BR',
      reservationId,
    });

    matchId = match.id;

    await service.startMatch(matchId, captainUserId);
  });

  afterAll(async () => {
    try {
      await prisma.match.deleteMany({
        where: { reservationId },
      });

      if (userIds.length > 0) {
        await prisma.user.deleteMany({
          where: {
            id: { in: userIds },
          },
        });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it('deve aceitar apenas um reporte simultâneo do mesmo capitão', async () => {
    const results = await Promise.allSettled([
      service.reportResult(matchId, captainUserId, MatchTeam.COG),
      service.reportResult(matchId, captainUserId, MatchTeam.LOCUST),
    ]);

    const successful = results.filter(
      (result) => result.status === 'fulfilled',
    );

    const rejected = results.filter((result) => result.status === 'rejected');

    expect(successful).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const failure = rejected[0];

    if (failure.status === 'rejected') {
      expect(failure.reason).toBeInstanceOf(ConflictException);
    }

    const reports = await prisma.matchResultReport.findMany({
      where: {
        matchId,
        captainId: captainProfileId,
      },
    });

    expect(reports).toHaveLength(1);

    expect([MatchTeam.COG, MatchTeam.LOCUST]).toContain(reports[0].winnerTeam);
  });
});
