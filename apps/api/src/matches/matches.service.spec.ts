import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { MatchTeam, Prisma } from '@prisma/client';

import { MatchesService } from './matches.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('MatchesService', () => {
  let service: MatchesService;

  const findManyMock = vi.fn();
  const findUniqueMock = vi.fn();
  const createMock = vi.fn();
  const transactionMock = vi.fn();
  const queryRawMock = vi.fn();
  const findFirstMock = vi.fn();
  const updateManyMock = vi.fn();
  const findUniqueOrThrowMock = vi.fn();

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
    findFirstMock.mockResolvedValue(null);
    queryRawMock.mockResolvedValue([]);
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
              findFirst: findFirstMock,
              create: createMock,
              updateMany: updateManyMock,
              findUniqueOrThrow: findUniqueOrThrowMock,
            },
            $queryRaw: queryRawMock,
            $transaction: transactionMock,
          },
        },
      ],
    }).compile();

    transactionMock.mockImplementation(
      async (callback: (tx: PrismaService) => Promise<unknown>) =>
        callback(module.get(PrismaService)),
    );

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

  it('deve definir um capitão para cada equipe', async () => {
    findManyMock.mockResolvedValue(playerProfileIds.map((id) => ({ id })));

    createMock.mockResolvedValue(existingMatch);

    await service.createMatch(input);

    const createArguments = createMock.mock.calls[0][0];
    const participants = createArguments.data.participants.create;

    const captains = participants.filter(
      (participant: { isCaptain: boolean }) => participant.isCaptain,
    );

    expect(captains).toHaveLength(2);

    expect(captains[0]).toMatchObject({
      playerProfileId: playerProfileIds[0],
      team: MatchTeam.COG,
      isCaptain: true,
    });

    expect(captains[1]).toMatchObject({
      playerProfileId: playerProfileIds[4],
      team: MatchTeam.LOCUST,
      isCaptain: true,
    });

    expect(
      participants.filter(
        (participant: { isCaptain: boolean }) => !participant.isCaptain,
      ),
    ).toHaveLength(6);
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
    expect(findUniqueMock).toHaveBeenCalledTimes(3);
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

  it('deve impedir a criação quando um jogador já possui partida ativa', async () => {
    findManyMock.mockResolvedValue(playerProfileIds.map((id) => ({ id })));

    findFirstMock.mockResolvedValue({
      id: 'partida-ativa-123',
    });

    await expect(service.createMatch(input)).rejects.toThrow(
      'Um ou mais jogadores já possuem uma partida ativa.',
    );

    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        status: {
          in: ['PENDING', 'IN_PROGRESS', 'DISPUTED'],
        },
        participants: {
          some: {
            playerProfileId: {
              in: playerProfileIds,
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    expect(queryRawMock).toHaveBeenCalledTimes(8);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('deve criar a partida somente após verificar os bloqueios e partidas ativas', async () => {
    findManyMock.mockResolvedValue(playerProfileIds.map((id) => ({ id })));

    findFirstMock.mockResolvedValue(null);
    createMock.mockResolvedValue(existingMatch);

    const result = await service.createMatch(input);

    expect(result).toEqual(existingMatch);
    expect(transactionMock).toHaveBeenCalledOnce();
    expect(queryRawMock).toHaveBeenCalledTimes(8);
    expect(findFirstMock).toHaveBeenCalledOnce();
    expect(createMock).toHaveBeenCalledOnce();

    const lastLockOrder = queryRawMock.mock.invocationCallOrder[7];

    const activeMatchCheckOrder = findFirstMock.mock.invocationCallOrder[0];

    const createOrder = createMock.mock.invocationCallOrder[0];

    expect(lastLockOrder).toBeLessThan(activeMatchCheckOrder);
    expect(activeMatchCheckOrder).toBeLessThan(createOrder);
  });

  describe('getMatchById', () => {
    const matchId = 'match-123';
    const participantUserId = 'user-1';

    const matchWithProfiles = {
      ...existingMatch,
      participants: existingMatch.participants.map((participant, index) => ({
        ...participant,
        playerProfile: {
          id: participant.playerProfileId,
          userId: `user-${index + 1}`,
          gamertag: `Player${index + 1}`,
          country: 'BR',
        },
      })),
    };

    it('deve permitir que um participante consulte sua partida', async () => {
      findUniqueMock.mockResolvedValue(matchWithProfiles);

      const result = await service.getMatchById(matchId, participantUserId);

      expect(result).toEqual(matchWithProfiles);

      expect(findUniqueMock).toHaveBeenCalledWith({
        where: {
          id: matchId,
        },
        include: {
          participants: {
            include: {
              playerProfile: {
                select: {
                  id: true,
                  userId: true,
                  gamertag: true,
                  country: true,
                },
              },
            },
          },
        },
      });
    });

    it('deve impedir acesso de usuários que não participam', async () => {
      findUniqueMock.mockResolvedValue(matchWithProfiles);

      await expect(
        service.getMatchById(matchId, 'usuario-externo'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deve retornar 404 quando a partida não existe', async () => {
      findUniqueMock.mockResolvedValue(null);

      await expect(
        service.getMatchById('partida-inexistente', participantUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('startMatch', () => {
    const matchId = '550e8400-e29b-41d4-a716-446655440000';
    const captainUserId = 'user-captain';

    const pendingMatch = {
      id: matchId,
      status: 'PENDING',
      participants: [{ id: 'captain-participant' }],
    };

    it('deve permitir que um capitão inicie a partida', async () => {
      findUniqueMock.mockResolvedValue(pendingMatch);
      updateManyMock.mockResolvedValue({ count: 1 });

      const startedMatch = {
        ...existingMatch,
        id: matchId,
        status: 'IN_PROGRESS',
      };

      findUniqueOrThrowMock.mockResolvedValue(startedMatch);

      const result = await service.startMatch(matchId, captainUserId);

      expect(result.status).toBe('IN_PROGRESS');

      expect(findUniqueMock).toHaveBeenCalledWith({
        where: { id: matchId },
        select: {
          id: true,
          status: true,
          participants: {
            where: {
              isCaptain: true,
              playerProfile: { userId: captainUserId },
            },
            select: { id: true },
          },
        },
      });

      expect(updateManyMock).toHaveBeenCalledWith({
        where: {
          id: matchId,
          status: 'PENDING',
        },
        data: {
          status: 'IN_PROGRESS',
          startedAt: expect.any(Date),
        },
      });
    });

    it('deve impedir jogadores que não são capitães', async () => {
      findUniqueMock.mockResolvedValue({
        ...pendingMatch,
        participants: [],
      });

      await expect(service.startMatch(matchId, 'user-common')).rejects.toThrow(
        ForbiddenException,
      );

      expect(updateManyMock).not.toHaveBeenCalled();
    });

    it('deve retornar 404 para partida inexistente', async () => {
      findUniqueMock.mockResolvedValue(null);

      await expect(service.startMatch(matchId, captainUserId)).rejects.toThrow(
        NotFoundException,
      );

      expect(updateManyMock).not.toHaveBeenCalled();
    });

    it('deve impedir iniciar uma partida já iniciada', async () => {
      findUniqueMock.mockResolvedValue({
        ...pendingMatch,
        status: 'IN_PROGRESS',
      });

      await expect(service.startMatch(matchId, captainUserId)).rejects.toThrow(
        ConflictException,
      );

      expect(updateManyMock).not.toHaveBeenCalled();
    });

    it('deve rejeitar quando outra solicitação iniciou a partida', async () => {
      findUniqueMock.mockResolvedValue(pendingMatch);
      updateManyMock.mockResolvedValue({ count: 0 });

      await expect(service.startMatch(matchId, captainUserId)).rejects.toThrow(
        ConflictException,
      );

      expect(findUniqueOrThrowMock).not.toHaveBeenCalled();
    });
  });
});
