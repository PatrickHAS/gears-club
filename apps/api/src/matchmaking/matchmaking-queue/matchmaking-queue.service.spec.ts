import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';

import { MatchmakingQueueService } from './matchmaking-queue.service.js';
import { RedisService } from '../../redis/redis.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('MatchmakingQueueService', () => {
  let service: MatchmakingQueueService;

  const evalMock = vi.fn();

  beforeEach(async () => {
    evalMock.mockReset();

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
          useValue: {},
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
});
