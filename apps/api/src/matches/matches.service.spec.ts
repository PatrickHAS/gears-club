import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { MatchTeam } from '@prisma/client';

import { MatchesService } from './matches.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('MatchesService', () => {
  let service: MatchesService;

  const findManyMock = vi.fn();
  const createMock = vi.fn();

  const playerProfileIds = Array.from(
    { length: 8 },
    (_, index) => `player-${index + 1}`,
  );

  beforeEach(async () => {
    findManyMock.mockReset();
    createMock.mockReset();

    const module = await Test.createTestingModule({
      providers: [
        MatchesService,
        {
          provide: PrismaService,
          useValue: {
            playerProfile: {
              findMany: findManyMock,
            },
            match: {
              create: createMock,
            },
          },
        },
      ],
    }).compile();

    service = module.get(MatchesService);
  });

  it('deve criar uma partida com 8 jogadores', async () => {
    findManyMock.mockResolvedValue(playerProfileIds.map((id) => ({ id })));

    createMock.mockResolvedValue({
      id: 'match-123',
      mode: 'DEMOLITION',
      region: 'BR',
      participants: [],
    });

    const result = await service.createMatch({
      playerProfileIds,
      region: 'BR',
    });

    expect(result.id).toBe('match-123');
    expect(createMock).toHaveBeenCalledOnce();
  });

  it('deve distribuir 4 jogadores em cada equipe', async () => {
    findManyMock.mockResolvedValue(playerProfileIds.map((id) => ({ id })));

    createMock.mockResolvedValue({
      id: 'match-123',
      participants: [],
    });

    await service.createMatch({
      playerProfileIds,
      region: 'BR',
    });

    const createArguments = createMock.mock.calls[0][0];

    const participants = createArguments.data.participants.create;

    const cog = participants.filter(
      (player: { team: MatchTeam }) => player.team === MatchTeam.COG,
    );

    const locust = participants.filter(
      (player: { team: MatchTeam }) => player.team === MatchTeam.LOCUST,
    );

    expect(cog).toHaveLength(4);
    expect(locust).toHaveLength(4);
  });

  it('deve rejeitar partidas com menos de 8 jogadores', async () => {
    await expect(
      service.createMatch({
        playerProfileIds: playerProfileIds.slice(0, 7),
        region: 'BR',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(createMock).not.toHaveBeenCalled();
  });

  it('deve rejeitar jogadores duplicados', async () => {
    const duplicatedPlayers = [
      ...playerProfileIds.slice(0, 7),
      playerProfileIds[0],
    ];

    await expect(
      service.createMatch({
        playerProfileIds: duplicatedPlayers,
        region: 'BR',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(createMock).not.toHaveBeenCalled();
  });

  it('deve rejeitar região inválida', async () => {
    await expect(
      service.createMatch({
        playerProfileIds,
        region: 'BRA',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(createMock).not.toHaveBeenCalled();
  });

  it('deve rejeitar perfis inexistentes', async () => {
    findManyMock.mockResolvedValue(
      playerProfileIds.slice(0, 7).map((id) => ({ id })),
    );

    await expect(
      service.createMatch({
        playerProfileIds,
        region: 'BR',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(createMock).not.toHaveBeenCalled();
  });
});
