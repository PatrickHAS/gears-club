import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';

import { MatchmakingQueueService } from './matchmaking-queue.service.js';
import { RedisService } from '../../redis/redis.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('MatchmakingQueueService', () => {
  let service: MatchmakingQueueService;

  const evalMock = vi.fn();
  const findManyMock = vi.fn();

  beforeEach(async () => {
    evalMock.mockReset();
    findManyMock.mockReset();

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
});
