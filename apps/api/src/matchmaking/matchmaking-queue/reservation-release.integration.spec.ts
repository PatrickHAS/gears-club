import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createClient } from 'redis';

import { MatchmakingQueueService } from './matchmaking-queue.service.js';
import { RedisService } from '../../redis/redis.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('Redis - liberação real de reservas', () => {
  const redis = createClient({
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  });

  // Evita conflitos com jogadores e reservas reais.
  const testId = `integration-${crypto.randomUUID()}`;
  const reservationId = `${testId}-reservation`;

  const userIds = Array.from(
    { length: 8 },
    (_, index) => `${testId}-user-${index + 1}`,
  );

  const reservationKey = `matchmaking:reservation:${reservationId}`;

  const lockKeys = userIds.map(
    (userId) => `matchmaking:player:reservation:${userId}`,
  );

  const allKeys = [reservationKey, ...lockKeys];

  let service: MatchmakingQueueService;

  async function prepareReservation() {
    await redis.set(reservationKey, JSON.stringify({ userIds }), { EX: 120 });

    for (const key of lockKeys) {
      await redis.set(key, reservationId, { EX: 120 });
    }
  }

  beforeAll(async () => {
    await redis.connect();

    const redisService = {
      getClient: () => redis,
    } as unknown as RedisService;

    const prismaService = {} as PrismaService;

    service = new MatchmakingQueueService(redisService, prismaService);
  });

  afterAll(async () => {
    if (redis.isOpen) {
      await redis.del(allKeys);
      await redis.quit();
    }
  });

  it('não libera uma reserva com jogador incorreto', async () => {
    await prepareReservation();

    const invalidPlayers = [...userIds];
    invalidPlayers[7] = `${testId}-invalid-user`;

    const result = await service.releaseReservation(
      invalidPlayers,
      reservationId,
    );

    expect(result).toBe(false);
    expect(await redis.exists(reservationKey)).toBe(1);

    for (const key of lockKeys) {
      expect(await redis.exists(key)).toBe(1);
    }
  });

  it('libera uma reserva válida e seus oito bloqueios', async () => {
    const result = await service.releaseReservation(userIds, reservationId);

    expect(result).toBe(true);
    expect(await redis.exists(reservationKey)).toBe(0);

    for (const key of lockKeys) {
      expect(await redis.exists(key)).toBe(0);
    }
  });

  it('não libera novamente uma reserva inexistente', async () => {
    const result = await service.releaseReservation(userIds, reservationId);

    expect(result).toBe(false);
  });
});
