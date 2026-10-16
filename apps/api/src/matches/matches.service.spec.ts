import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { MatchTeam, Prisma } from '@prisma/client';

import { MatchesService } from './matches.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('MatchesService', () => {
  let service: MatchesService;

  const findManyMock = vi.fn();
  const findUniqueMock = vi.fn();
  const createMock = vi.fn();

  const reservationId = '550e8400-e29b-41d4-a716-446655440000';

  const playerProfileIds = Array.from(
    { length: 8 },
    (_, index) => `player-${index + 1}`,
  );

  const input = {
    playerProfileIds,
    region: 'BR',
    reservationId,
  };

  const existingMatch = {
    id: 'match-123',
    reservationId,
    mode: 'DEMOLITION',
    region: 'BR',
    status: 'PENDING',
    participants: playerProfileIds.map((playerProfileId, index) => ({
      playerProfileId,
      team: index < 4 ? MatchTeam.COG : MatchTeam.LOCUST,
    })),
  };

  beforeEach(async () => {
    vi.resetAllMocks();

    findUniqueMock.mockResolvedValue(null);

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
              findUnique: findUniqueMock,
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

    createMock.mockResolvedValue(existingMatch);

    const result = await service.createMatch(input);

    expect(result.id).toBe('match-123');

    expect(createMock).toHaveBeenCalledOnce();

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reservationId,
          region: 'BR',
          mode: 'DEMOLITION',
        }),
      }),
    );
  });

  it('deve distribuir 4 jogadores em cada equipe', async () => {
    findManyMock.mockResolvedValue(playerProfileIds.map((id) => ({ id })));

    createMock.mockResolvedValue(existingMatch);

    await service.createMatch(input);

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
        ...input,
        playerProfileIds: playerProfileIds.slice(0, 7),
      }),
    ).rejects.toThrow(BadRequestException);

    expect(createMock).not.toHaveBeenCalled();
  });

  it('deve rejeitar jogadores duplicados', async () => {
    await expect(
      service.createMatch({
        ...input,
        playerProfileIds: [
          ...playerProfileIds.slice(0, 7),
          playerProfileIds[0],
        ],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(createMock).not.toHaveBeenCalled();
  });

  it('deve rejeitar região inválida', async () => {
    await expect(
      service.createMatch({
        ...input,
        region: 'BRA',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(createMock).not.toHaveBeenCalled();
  });

  it('deve rejeitar identificador de reserva inválido', async () => {
    await expect(
      service.createMatch({
        ...input,
        reservationId: 'reserva-invalida',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(createMock).not.toHaveBeenCalled();
  });

  it('deve rejeitar perfis inexistentes', async () => {
    findManyMock.mockResolvedValue(
      playerProfileIds.slice(0, 7).map((id) => ({ id })),
    );

    await expect(service.createMatch(input)).rejects.toThrow(
      BadRequestException,
    );

    expect(createMock).not.toHaveBeenCalled();
  });

  it('deve reutilizar uma partida existente', async () => {
    findUniqueMock.mockResolvedValue(existingMatch);

    const result = await service.createMatch(input);

    expect(result).toEqual(existingMatch);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('deve reutilizar uma partida após conflito de unicidade', async () => {
    findManyMock.mockResolvedValue(playerProfileIds.map((id) => ({ id })));

    findUniqueMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingMatch);

    createMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
        meta: {
          target: ['reservationId'],
        },
      }),
    );

    const result = await service.createMatch(input);

    expect(result).toEqual(existingMatch);
    expect(createMock).toHaveBeenCalledOnce();
    expect(findUniqueMock).toHaveBeenCalledTimes(2);
  });

  it('deve rejeitar reserva existente com região diferente', async () => {
    findUniqueMock.mockResolvedValue(existingMatch);

    await expect(
      service.createMatch({
        ...input,
        region: 'US',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(createMock).not.toHaveBeenCalled();
  });

  it('deve rejeitar reserva existente com jogadores diferentes', async () => {
    findUniqueMock.mockResolvedValue(existingMatch);

    await expect(
      service.createMatch({
        ...input,
        playerProfileIds: [...playerProfileIds.slice(0, 7), 'outro-jogador'],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(createMock).not.toHaveBeenCalled();
  });

  it('deve rejeitar reserva existente com equipes inválidas', async () => {
    findUniqueMock.mockResolvedValue({
      ...existingMatch,
      participants: existingMatch.participants.map((participant) => ({
        ...participant,
        team: MatchTeam.COG,
      })),
    });

    await expect(service.createMatch(input)).rejects.toThrow(
      BadRequestException,
    );

    expect(createMock).not.toHaveBeenCalled();
  });
});
