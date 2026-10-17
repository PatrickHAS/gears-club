import { randomUUID } from 'node:crypto';

import { ConflictException, ForbiddenException } from '@nestjs/common';
import { MatchTeam } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MatchesService } from './matches.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('MatchesService - evidências de disputas', () => {
  const prisma = new PrismaService();
  const service = new MatchesService(prisma);

  const userIds: string[] = [];
  const profileIds: string[] = [];

  const reservationId = randomUUID();

  let matchId: string;
  let captainUserId: string;
  let captainProfileId: string;
  let secondCaptainUserId: string;

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
    secondCaptainUserId = userIds[4];

    const match = await service.createMatch({
      playerProfileIds: profileIds,
      region: 'BR',
      reservationId,
    });

    matchId = match.id;

    await service.startMatch(matchId, captainUserId);

    await service.reportResult(matchId, captainUserId, MatchTeam.COG);

    await service.reportResult(matchId, secondCaptainUserId, MatchTeam.LOCUST);
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

  it('deve registrar a evidência do capitão no PostgreSQL', async () => {
    const imageKey = `disputes/${randomUUID()}.png`;

    const evidence = await service.submitDisputeEvidence(
      matchId,
      captainUserId,
      imageKey,
    );

    expect(evidence.matchId).toBe(matchId);
    expect(evidence.captainId).toBe(captainProfileId);
    expect(evidence.imageKey).toBe(imageKey);

    const saved = await prisma.matchDisputeEvidence.findUnique({
      where: { id: evidence.id },
    });

    expect(saved).not.toBeNull();
    expect(saved?.captainId).toBe(captainProfileId);
    expect(saved?.imageKey).toBe(imageKey);
  });

  it('deve impedir que um jogador comum envie evidências', async () => {
    await expect(
      service.submitDisputeEvidence(
        matchId,
        userIds[1],
        `disputes/${randomUUID()}.png`,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('deve impedir evidências após a partida sair de disputa', async () => {
    await prisma.match.update({
      where: { id: matchId },
      data: { status: 'CANCELLED' },
    });

    await expect(
      service.submitDisputeEvidence(
        matchId,
        captainUserId,
        `disputes/${randomUUID()}.png`,
      ),
    ).rejects.toThrow(ConflictException);
  });
});
