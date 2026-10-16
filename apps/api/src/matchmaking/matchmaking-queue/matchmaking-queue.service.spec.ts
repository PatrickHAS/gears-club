import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';

import { MatchmakingQueueService } from './matchmaking-queue.service.js';
import { RedisService } from '../../redis/redis.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('MatchmakingQueueService', () => {
  let service: MatchmakingQueueService;

  const evalMock = vi.fn();
  const findManyMock = vi.fn();
  const findUniqueMock = vi.fn();

  beforeEach(async () => {
    evalMock.mockReset();
    findManyMock.mockReset();
    findUniqueMock.mockReset();

    const module = await Test.createTestingModule({
      providers: [
        MatchmakingQueueService,
        {
          provide: RedisService,
          useValue: {
            getClient: () => ({
              eval: evalMock,
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            playerProfile: {
              findMany: findManyMock,
              findUnique: findUniqueMock,
            },
          },
        },
      ],
    }).compile();

    service = module.get(MatchmakingQueueService);
  });

  it('deve retornar apenas jogadores ativos', async () => {
    const entry = {
      userId: 'jogador_ativo',
      joinedAt: '2026-10-16T18:00:00.000Z',
    };

    evalMock.mockResolvedValue([JSON.stringify(entry)]);

    const result = await service.getActiveQueue();

    expect(result).toEqual([entry]);

    expect(evalMock).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('ZREM'"),
      {
        keys: ['matchmaking:queue:index'],
        arguments: ['matchmaking:queue:'],
      },
    );
  });

  it('deve retornar uma lista vazia quando não houver jogadores ativos', async () => {
    evalMock.mockResolvedValue([]);

    const result = await service.getActiveQueue();

    expect(result).toEqual([]);
  });

  it('deve preparar candidatos com ELO e regiões aceitas', async () => {
    const entries = [
      {
        userId: 'user-br',
        joinedAt: '2026-10-16T18:00:00.000Z',
      },
      {
        userId: 'user-us',
        joinedAt: '2026-10-16T18:01:00.000Z',
      },
    ];

    evalMock.mockResolvedValue(entries.map((entry) => JSON.stringify(entry)));

    findManyMock.mockResolvedValue([
      {
        userId: 'user-us',
        gamertag: 'PlayerUS',
        country: 'US',
        rating: null,
        matchmakingRegions: [],
      },
      {
        userId: 'user-br',
        gamertag: 'PlayerBR',
        country: 'BR',
        rating: { elo: 1200 },
        matchmakingRegions: [
          { country: 'MX' },
          { country: 'US' },
          { country: 'BR' },
        ],
      },
    ]);

    const result = await service.getCandidates();

    expect(result).toEqual([
      {
        userId: 'user-br',
        joinedAt: entries[0].joinedAt,
        gamertag: 'PlayerBR',
        country: 'BR',
        elo: 1200,
        acceptedCountries: ['BR', 'MX', 'US'],
      },
      {
        userId: 'user-us',
        joinedAt: entries[1].joinedAt,
        gamertag: 'PlayerUS',
        country: 'US',
        elo: 1000,
        acceptedCountries: ['US'],
      },
    ]);

    expect(findManyMock).toHaveBeenCalledOnce();
  });

  it('deve ignorar jogadores com perfil incompleto', async () => {
    evalMock.mockResolvedValue([
      JSON.stringify({
        userId: 'user-incompleto',
        joinedAt: '2026-10-16T18:00:00.000Z',
      }),
    ]);

    findManyMock.mockResolvedValue([
      {
        userId: 'user-incompleto',
        gamertag: null,
        country: 'BR',
        rating: { elo: 1000 },
        matchmakingRegions: [],
      },
    ]);

    const result = await service.getCandidates();

    expect(result).toEqual([]);
  });

  it('deve encontrar uma partida com 8 jogadores compatíveis', async () => {
    const entries = Array.from({ length: 8 }, (_, i) => ({
      userId: `user-${i}`,
      joinedAt: new Date(Date.UTC(2026, 9, 16, 18, i)).toISOString(),
    }));

    evalMock.mockResolvedValue(entries.map((entry) => JSON.stringify(entry)));

    findManyMock.mockResolvedValue(
      entries.map((entry, i) => ({
        userId: entry.userId,
        gamertag: `Player${i}`,
        country: 'BR',
        rating: { elo: 1000 + i * 10 },
        matchmakingRegions: [{ country: 'US' }],
      })),
    );

    const result = await service.findMatch();

    expect(result).not.toBeNull();
    expect(result?.players).toHaveLength(8);
    expect(result?.eloDifference).toBe(70);
    expect(['BR', 'US']).toContain(result?.region);

    expect(result?.players.map((player) => player.userId)).toEqual(
      entries.map((entry) => entry.userId),
    );
  });

  it('não deve encontrar partida quando houver menos de 8 candidatos', async () => {
    const entries = Array.from({ length: 7 }, (_, i) => ({
      userId: `user-${i}`,
      joinedAt: new Date(Date.UTC(2026, 9, 16, 18, i)).toISOString(),
    }));

    evalMock.mockResolvedValue(entries.map((entry) => JSON.stringify(entry)));

    findManyMock.mockResolvedValue(
      entries.map((entry, i) => ({
        userId: entry.userId,
        gamertag: `Player${i}`,
        country: 'BR',
        rating: { elo: 1000 },
        matchmakingRegions: [],
      })),
    );

    const result = await service.findMatch();

    expect(result).toBeNull();
  });

  it('deve reservar 8 jogadores disponíveis', async () => {
    const userIds = Array.from({ length: 8 }, (_, i) => `user-${i}`);

    evalMock.mockResolvedValue(1);

    const result = await service.reservePlayers(userIds, 'reserva-123');

    expect(result).toBe(true);

    expect(evalMock).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('ZREM'"),
      {
        keys: [
          'matchmaking:reservation:reserva-123',
          'matchmaking:queue:index',

          ...userIds.map((id) => `matchmaking:queue:${id}`),

          ...userIds.map((id) => `matchmaking:player:reservation:${id}`),
        ],
        arguments: ['120', ...userIds, 'reserva-123'],
      },
    );
  });

  it('não deve reservar se algum jogador estiver indisponível', async () => {
    const userIds = Array.from({ length: 8 }, (_, i) => `user-${i}`);

    evalMock.mockResolvedValue(0);

    const result = await service.reservePlayers(userIds, 'reserva-456');

    expect(result).toBe(false);
  });

  it('deve permitir entrada na fila quando o jogador estiver disponível', async () => {
    findUniqueMock.mockResolvedValue({
      gamertag: 'PlayerBR',
      country: 'BR',
    });

    evalMock.mockResolvedValue(1);

    const result = await service.join('user-br');

    expect(result.userId).toBe('user-br');
    expect(result.joinedAt).toEqual(expect.any(String));

    expect(evalMock).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('EXISTS', KEYS[3])"),
      {
        keys: [
          'matchmaking:queue:user-br',
          'matchmaking:queue:index',
          'matchmaking:player:reservation:user-br',
        ],
        arguments: [expect.any(String), '120', expect.any(String), 'user-br'],
      },
    );
  });

  it('deve impedir entrada duplicada na fila', async () => {
    findUniqueMock.mockResolvedValue({
      gamertag: 'PlayerBR',
      country: 'BR',
    });

    evalMock.mockResolvedValue(0);

    await expect(service.join('user-br')).rejects.toThrow(
      'Você já está na fila de matchmaking.',
    );
  });

  it('deve impedir entrada de jogador com reserva ativa', async () => {
    findUniqueMock.mockResolvedValue({
      gamertag: 'PlayerBR',
      country: 'BR',
    });

    evalMock.mockResolvedValue(2);

    await expect(service.join('user-br')).rejects.toThrow(
      'Você já possui uma reserva ativa de matchmaking.',
    );
  });

  it('deve rejeitar uma reserva com jogadores duplicados', async () => {
    const userIds = Array(8).fill('mesmo-jogador');

    await expect(
      service.reservePlayers(userIds, 'reserva-789'),
    ).rejects.toThrow(
      'A reserva exige 8 jogadores distintos e um identificador válido.',
    );

    expect(evalMock).not.toHaveBeenCalled();
  });

  it('deve liberar uma reserva válida', async () => {
    const userIds = Array.from(
      { length: 8 },
      (_, index) => `user-${index + 1}`,
    );

    evalMock.mockResolvedValue(1);

    const result = await service.releaseReservation(userIds, 'reserva-123');

    expect(result).toBe(true);

    expect(evalMock).toHaveBeenCalledWith(
      expect.stringContaining('cjson.decode'),
      {
        keys: [
          'matchmaking:reservation:reserva-123',
          ...userIds.map((id) => `matchmaking:player:reservation:${id}`),
        ],
        arguments: ['reserva-123', ...userIds],
      },
    );
  });

  it('não deve liberar uma reserva inexistente ou incompatível', async () => {
    const userIds = Array.from(
      { length: 8 },
      (_, index) => `user-${index + 1}`,
    );

    evalMock.mockResolvedValue(0);

    const result = await service.releaseReservation(
      userIds,
      'reserva-inexistente',
    );

    expect(result).toBe(false);
  });

  it('deve informar erro quando o Redis falhar na liberação', async () => {
    const userIds = Array.from(
      { length: 8 },
      (_, index) => `user-${index + 1}`,
    );

    evalMock.mockRejectedValue(new Error('Redis indisponível'));

    await expect(
      service.releaseReservation(userIds, 'reserva-123'),
    ).rejects.toThrow('Não foi possível liberar a reserva de matchmaking.');
  });
});
