import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';

import { MatchTeam } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { MatchesService } from './matches.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('MatchesService - homologação e ELO', () => {
  const prisma = new PrismaService();
  const service = new MatchesService(prisma);

  const userIds: string[] = [];
  const profileIds: string[] = [];

  const reservationId = randomUUID();

  let matchId: string;

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
          username: `validation_${testId}_${index}`,
          email: `validation_${testId}_${index}@example.test`,
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

    const match = await service.createMatch({
      playerProfileIds: profileIds,
      region: 'BR',
      reservationId,
    });

    matchId = match.id;

    await service.startMatch(matchId, userIds[0]);

    await service.reportResult(matchId, userIds[0], MatchTeam.COG);
    await service.reportResult(matchId, userIds[4], MatchTeam.COG);
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

  it('deve homologar a partida e atualizar os 8 rankings', async () => {
    const result = await service.validateMatchResult(matchId);

    expect(result.status).toBe('COMPLETED');
    expect(result.completedAt).toBeInstanceOf(Date);

    const ratings = await prisma.playerRating.findMany({
      where: {
        playerProfileId: { in: profileIds },
      },
    });

    expect(ratings).toHaveLength(8);

    for (const rating of ratings) {
      const playerIndex = profileIds.indexOf(rating.playerProfileId);
      const won = playerIndex < 4;

      expect(rating.elo).toBe(won ? 1016 : 984);
      expect(rating.wins).toBe(won ? 1 : 0);
      expect(rating.losses).toBe(won ? 0 : 1);
      expect(rating.matches).toBe(1);
    }
  });

  it('não deve atualizar o ELO duas vezes na mesma partida', async () => {
    await expect(service.validateMatchResult(matchId)).rejects.toThrow(
      ConflictException,
    );

    const match = await prisma.match.findUniqueOrThrow({
      where: { id: matchId },
    });

    expect(match.status).toBe('COMPLETED');

    const ratings = await prisma.playerRating.findMany({
      where: {
        playerProfileId: { in: profileIds },
      },
    });

    expect(ratings).toHaveLength(8);

    for (const rating of ratings) {
      const playerIndex = profileIds.indexOf(rating.playerProfileId);
      const won = playerIndex < 4;

      expect(rating.elo).toBe(won ? 1016 : 984);
      expect(rating.wins).toBe(won ? 1 : 0);
      expect(rating.losses).toBe(won ? 0 : 1);
      expect(rating.matches).toBe(1);
    }
  });

  it('deve aceitar apenas uma homologação simultânea', async () => {
    const newReservationId = randomUUID();

    const match = await service.createMatch({
      playerProfileIds: profileIds,
      region: 'BR',
      reservationId: newReservationId,
    });

    try {
      await service.startMatch(match.id, userIds[0]);

      await service.reportResult(match.id, userIds[0], MatchTeam.COG);
      await service.reportResult(match.id, userIds[4], MatchTeam.COG);

      const results = await Promise.allSettled([
        service.validateMatchResult(match.id),
        service.validateMatchResult(match.id),
      ]);

      const successful = results.filter(
        (result) => result.status === 'fulfilled',
      );

      const rejected = results.filter((result) => result.status === 'rejected');

      expect(successful).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const updatedMatch = await prisma.match.findUniqueOrThrow({
        where: { id: match.id },
      });

      expect(updatedMatch.status).toBe('COMPLETED');

      const ratings = await prisma.playerRating.findMany({
        where: {
          playerProfileId: { in: profileIds },
        },
      });

      expect(ratings).toHaveLength(8);

      for (const rating of ratings) {
        const won = profileIds.indexOf(rating.playerProfileId) < 4;

        expect(rating.matches).toBe(2);
        expect(rating.wins).toBe(won ? 2 : 0);
        expect(rating.losses).toBe(won ? 0 : 2);
        expect(rating.elo).toBe(won ? 1031 : 969);
      }
    } finally {
      await prisma.match.deleteMany({
        where: { reservationId: newReservationId },
      });
    }
  });

  it('deve reverter todos os rankings quando a homologação falha', async () => {
    const newReservationId = randomUUID();

    const match = await service.createMatch({
      playerProfileIds: profileIds,
      region: 'BR',
      reservationId: newReservationId,
    });

    try {
      await service.startMatch(match.id, userIds[0]);

      await service.reportResult(match.id, userIds[0], MatchTeam.COG);
      await service.reportResult(match.id, userIds[4], MatchTeam.COG);

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
        await expect(service.validateMatchResult(match.id)).rejects.toThrow(
          'Falha simulada no quinto jogador',
        );
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

      expect(updatedMatch.status).toBe('AWAITING_VALIDATION');
      expect(updatedMatch.completedAt).toBeNull();
    } finally {
      await prisma.match.deleteMany({
        where: { reservationId: newReservationId },
      });
    }
  });
});
