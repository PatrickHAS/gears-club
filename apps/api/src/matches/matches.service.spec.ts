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
  const findUniqueResultReportMock = vi.fn();
  const createResultReportMock = vi.fn();
  const findManyResultReportMock = vi.fn();
  const updateMatchMock = vi.fn();

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
    findUniqueResultReportMock.mockResolvedValue(null);
    findManyResultReportMock.mockResolvedValue([]);

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
              update: updateMatchMock,
              updateMany: updateManyMock,
              findUniqueOrThrow: findUniqueOrThrowMock,
            },
            matchResultReport: {
              findUnique: findUniqueResultReportMock,
              findMany: findManyResultReportMock,
              create: createResultReportMock,
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
          in: ['PENDING', 'IN_PROGRESS', 'AWAITING_VALIDATION', 'DISPUTED'],
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

  describe('reportResult', () => {
    const matchId = '550e8400-e29b-41d4-a716-446655440000';
    const captainUserId = 'user-captain';
    const captainProfileId = 'profile-captain';

    const matchInProgress = {
      id: matchId,
      status: 'IN_PROGRESS',
      participants: [{ playerProfileId: captainProfileId }],
    };

    it('deve bloquear a partida antes de consultar e criar o reporte', async () => {
      findUniqueMock.mockResolvedValue(matchInProgress);

      createResultReportMock.mockResolvedValue({
        id: 'report-123',
        matchId,
        captainId: captainProfileId,
        winnerTeam: MatchTeam.COG,
      });

      await service.reportResult(matchId, captainUserId, MatchTeam.COG);

      expect(queryRawMock).toHaveBeenCalledOnce();
      expect(findUniqueMock).toHaveBeenCalledOnce();
      expect(findUniqueResultReportMock).toHaveBeenCalledOnce();
      expect(createResultReportMock).toHaveBeenCalledOnce();

      const lockOrder = queryRawMock.mock.invocationCallOrder[0];
      const matchLookupOrder = findUniqueMock.mock.invocationCallOrder[0];
      const reportLookupOrder =
        findUniqueResultReportMock.mock.invocationCallOrder[0];
      const createOrder = createResultReportMock.mock.invocationCallOrder[0];

      expect(lockOrder).toBeLessThan(matchLookupOrder);
      expect(matchLookupOrder).toBeLessThan(reportLookupOrder);
      expect(reportLookupOrder).toBeLessThan(createOrder);
    });

    it('deve permitir que um capitão reporte o vencedor', async () => {
      findUniqueMock.mockResolvedValue(matchInProgress);

      const report = {
        id: 'report-123',
        matchId,
        captainId: captainProfileId,
        winnerTeam: MatchTeam.COG,
      };

      createResultReportMock.mockResolvedValue(report);

      const result = await service.reportResult(
        matchId,
        captainUserId,
        MatchTeam.COG,
      );

      expect(result).toEqual(report);
      expect(transactionMock).toHaveBeenCalledOnce();
      expect(queryRawMock).toHaveBeenCalledOnce();

      expect(createResultReportMock).toHaveBeenCalledWith({
        data: {
          matchId,
          captainId: captainProfileId,
          winnerTeam: MatchTeam.COG,
        },
      });
    });

    it('deve impedir jogadores que não são capitães', async () => {
      findUniqueMock.mockResolvedValue({
        ...matchInProgress,
        participants: [],
      });

      await expect(
        service.reportResult(matchId, 'user-common', MatchTeam.COG),
      ).rejects.toThrow(ForbiddenException);

      expect(createResultReportMock).not.toHaveBeenCalled();
    });

    it('deve retornar 404 para partida inexistente', async () => {
      findUniqueMock.mockResolvedValue(null);

      await expect(
        service.reportResult(matchId, captainUserId, MatchTeam.COG),
      ).rejects.toThrow(NotFoundException);

      expect(createResultReportMock).not.toHaveBeenCalled();
    });

    it('deve impedir reporte de partida que não está em andamento', async () => {
      findUniqueMock.mockResolvedValue({
        ...matchInProgress,
        status: 'PENDING',
      });

      await expect(
        service.reportResult(matchId, captainUserId, MatchTeam.COG),
      ).rejects.toThrow(ConflictException);

      expect(createResultReportMock).not.toHaveBeenCalled();
    });

    it('deve impedir que o capitão reporte duas vezes', async () => {
      findUniqueMock.mockResolvedValue(matchInProgress);

      findUniqueResultReportMock.mockResolvedValue({
        id: 'existing-report',
        matchId,
        captainId: captainProfileId,
        winnerTeam: MatchTeam.LOCUST,
      });

      await expect(
        service.reportResult(matchId, captainUserId, MatchTeam.COG),
      ).rejects.toThrow(ConflictException);

      expect(createResultReportMock).not.toHaveBeenCalled();
    });

    it('deve aguardar homologação quando os dois capitães concordam', async () => {
      findUniqueMock.mockResolvedValue(matchInProgress);

      const report = {
        id: 'report-2',
        matchId,
        captainId: captainProfileId,
        winnerTeam: MatchTeam.COG,
      };

      createResultReportMock.mockResolvedValue(report);

      findManyResultReportMock.mockResolvedValue([
        {
          captainId: 'profile-captain-cog',
          winnerTeam: MatchTeam.COG,
        },
        {
          captainId: 'profile-captain-locust',
          winnerTeam: MatchTeam.COG,
        },
      ]);

      updateMatchMock.mockResolvedValue({
        id: matchId,
        status: 'AWAITING_VALIDATION',
      });

      const result = await service.reportResult(
        matchId,
        captainUserId,
        MatchTeam.COG,
      );

      expect(result).toEqual(report);

      expect(findManyResultReportMock).toHaveBeenCalledWith({
        where: { matchId },
        select: {
          captainId: true,
          winnerTeam: true,
        },
      });

      expect(updateMatchMock).toHaveBeenCalledWith({
        where: { id: matchId },
        data: {
          status: 'AWAITING_VALIDATION',
        },
      });
    });

    it('deve marcar a partida como disputada quando os capitães discordam', async () => {
      findUniqueMock.mockResolvedValue(matchInProgress);

      const report = {
        id: 'report-2',
        matchId,
        captainId: captainProfileId,
        winnerTeam: MatchTeam.LOCUST,
      };

      createResultReportMock.mockResolvedValue(report);

      findManyResultReportMock.mockResolvedValue([
        {
          captainId: 'profile-captain-cog',
          winnerTeam: MatchTeam.COG,
        },
        {
          captainId: 'profile-captain-locust',
          winnerTeam: MatchTeam.LOCUST,
        },
      ]);

      updateMatchMock.mockResolvedValue({
        id: matchId,
        status: 'DISPUTED',
      });

      const result = await service.reportResult(
        matchId,
        captainUserId,
        MatchTeam.LOCUST,
      );

      expect(result).toEqual(report);

      expect(updateMatchMock).toHaveBeenCalledWith({
        where: { id: matchId },
        data: {
          status: 'DISPUTED',
        },
      });
    });

    it('deve manter a partida em andamento quando apenas um capitão reporta', async () => {
      findUniqueMock.mockResolvedValue(matchInProgress);

      const report = {
        id: 'report-1',
        matchId,
        captainId: captainProfileId,
        winnerTeam: MatchTeam.COG,
      };

      createResultReportMock.mockResolvedValue(report);

      findManyResultReportMock.mockResolvedValue([
        {
          captainId: captainProfileId,
          winnerTeam: MatchTeam.COG,
        },
      ]);

      const result = await service.reportResult(
        matchId,
        captainUserId,
        MatchTeam.COG,
      );

      expect(result).toEqual(report);

      expect(findManyResultReportMock).toHaveBeenCalledOnce();

      // Nenhuma alteração no status antes do segundo reporte.
      expect(updateMatchMock).not.toHaveBeenCalled();
    });

    it('deve rejeitar um vencedor inválido', async () => {
      await expect(
        service.reportResult(matchId, captainUserId, 'INVALID' as MatchTeam),
      ).rejects.toThrow(BadRequestException);

      expect(transactionMock).not.toHaveBeenCalled();
      expect(createResultReportMock).not.toHaveBeenCalled();
    });
  });
});
