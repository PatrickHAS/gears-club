import { randomUUID } from 'node:crypto';

import { BadRequestException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MatchesService } from './matches.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('MatchesService - concorrência PostgreSQL', () => {
  const prisma = new PrismaService();
  const service = new MatchesService(prisma);

  const userIds: string[] = [];
  const profileIds: string[] = [];
  const reservationIds = [randomUUID(), randomUUID()];

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL não configurada.');
    }

    const databaseName = new URL(databaseUrl).pathname.slice(1);

    if (databaseName !== 'gears_club_test') {
      throw new Error(
        'Teste bloqueado: DATABASE_URL deve apontar para gears_club_test.',
      );
    }

    await prisma.$connect();

    const testId = randomUUID().slice(0, 8);

    for (let index = 0; index < 8; index++) {
      const user = await prisma.user.create({
        data: {
          username: `conc_${testId}_${index}`,
          email: `conc_${testId}_${index}@example.test`,
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

      userIds.push(user.id);

      if (!user.profile) {
        throw new Error('Perfil temporário não foi criado.');
      }

      profileIds.push(user.profile.id);
    }
  });

  afterAll(async () => {
    try {
      await prisma.match.deleteMany({
        where: {
          reservationId: {
            in: reservationIds,
          },
        },
      });

      if (userIds.length > 0) {
        await prisma.user.deleteMany({
          where: {
            id: {
              in: userIds,
            },
          },
        });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it('deve impedir duas partidas simultâneas com os mesmos jogadores', async () => {
    const results = await Promise.allSettled([
      service.createMatch({
        playerProfileIds: profileIds,
        region: 'BR',
        reservationId: reservationIds[0],
      }),
      service.createMatch({
        playerProfileIds: profileIds,
        region: 'BR',
        reservationId: reservationIds[1],
      }),
    ]);

    const successful = results.filter(
      (result) => result.status === 'fulfilled',
    );

    const rejected = results.filter((result) => result.status === 'rejected');

    expect(successful).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const failure = rejected[0];

    expect(failure.status).toBe('rejected');

    if (failure.status === 'rejected') {
      expect(failure.reason).toBeInstanceOf(BadRequestException);
    }

    const matches = await prisma.match.findMany({
      where: {
        reservationId: {
          in: reservationIds,
        },
      },
      include: {
        participants: true,
      },
    });

    expect(matches).toHaveLength(1);
    expect(matches[0].participants).toHaveLength(8);
  });
});
