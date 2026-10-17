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
import { EvidenceStorageService } from './evidence-storage/evidence-storage.service.js';

describe('MatchesService', () => {
  let service: MatchesService;

  const findManyMock = vi.fn();
  const findManyMatchesMock = vi.fn();
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
  const findManyParticipantsMock = vi.fn();
  const findFirstParticipantMock = vi.fn();
  const upsertPlayerRatingMock = vi.fn();
  const createDisputeEvidenceMock = vi.fn();
  const findManyDisputeEvidenceMock = vi.fn();
  const createDisputeResolutionMock = vi.fn();
  const findFirstDisputeEvidenceMock = vi.fn();
  const readEvidenceMock = vi.fn();
  const saveEvidenceMock = vi.fn();
  const removeEvidenceMock = vi.fn();

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
    findManyDisputeEvidenceMock.mockResolvedValue([]);

    createDisputeResolutionMock.mockResolvedValue({
      id: 'resolution-123',
      matchId: 'match-123',
      adminId: 'admin-123',
      winnerTeam: MatchTeam.COG,
      reason: 'Evidências verificadas pelo administrador.',
      evidenceIds: ['evidence-123'],
      gamertagsVerified: true,
    });

    saveEvidenceMock.mockResolvedValue(
      '550e8400-e29b-41d4-a716-446655440001.png',
    );
    findFirstDisputeEvidenceMock.mockResolvedValue(null);
    readEvidenceMock.mockResolvedValue(Buffer.from('imagem-privada'));

    removeEvidenceMock.mockResolvedValue(undefined);
    findFirstMock.mockResolvedValue(null);
    queryRawMock.mockResolvedValue([]);
    findUniqueMock.mockResolvedValue(null);
    findUniqueResultReportMock.mockResolvedValue(null);
    findManyResultReportMock.mockResolvedValue([]);
    findManyParticipantsMock.mockResolvedValue([]);
    findFirstParticipantMock.mockResolvedValue(null);
    createDisputeEvidenceMock.mockResolvedValue({
      id: 'evidence-123',
      matchId: '550e8400-e29b-41d4-a716-446655440000',
      captainId: 'captain-profile-123',
      imageKey: '550e8400-e29b-41d4-a716-446655440001.png',
      createdAt: new Date(),
    });

    const module = await Test.createTestingModule({
      providers: [
        MatchesService,
        {
          provide: EvidenceStorageService,
          useValue: {
            save: saveEvidenceMock,
            read: readEvidenceMock,
            remove: removeEvidenceMock,
          },
        },
        {
          provide: PrismaService,

          useValue: {
            playerProfile: {
              findMany: findManyMock,
            },
            match: {
              findMany: findManyMatchesMock,
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
            matchDisputeEvidence: {
              create: createDisputeEvidenceMock,
              findFirst: findFirstDisputeEvidenceMock,
              findMany: findManyDisputeEvidenceMock,
            },
            matchDisputeResolution: {
              create: createDisputeResolutionMock,
            },
            matchParticipant: {
              findMany: findManyParticipantsMock,
              findFirst: findFirstParticipantMock,
            },
            playerRating: {
              upsert: upsertPlayerRatingMock,
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

  describe('validateMatchResult', () => {
    const matchId = '550e8400-e29b-41d4-a716-446655440000';

    it('deve retornar 404 quando a partida não existe', async () => {
      findUniqueMock.mockResolvedValue(null);

      await expect(service.validateMatchResult(matchId)).rejects.toThrow(
        NotFoundException,
      );

      expect(upsertPlayerRatingMock).not.toHaveBeenCalled();
      expect(updateMatchMock).not.toHaveBeenCalled();
    });

    it('deve rejeitar partida que não aguarda homologação', async () => {
      findUniqueMock.mockResolvedValue({
        id: matchId,
        status: 'IN_PROGRESS',
        participants: [],
        resultReports: [],
      });

      await expect(service.validateMatchResult(matchId)).rejects.toThrow(
        ConflictException,
      );

      expect(upsertPlayerRatingMock).not.toHaveBeenCalled();
      expect(updateMatchMock).not.toHaveBeenCalled();
    });

    it('deve rejeitar partida já homologada', async () => {
      findUniqueMock.mockResolvedValue({
        id: matchId,
        status: 'COMPLETED',
        participants: [],
        resultReports: [],
      });

      await expect(service.validateMatchResult(matchId)).rejects.toThrow(
        ConflictException,
      );

      expect(upsertPlayerRatingMock).not.toHaveBeenCalled();
      expect(updateMatchMock).not.toHaveBeenCalled();
    });

    it('deve rejeitar partida com reportes divergentes', async () => {
      findUniqueMock.mockResolvedValue({
        id: matchId,
        status: 'AWAITING_VALIDATION',
        participants: [],
        resultReports: [
          { winnerTeam: MatchTeam.COG },
          { winnerTeam: MatchTeam.LOCUST },
        ],
      });

      await expect(service.validateMatchResult(matchId)).rejects.toThrow(
        ConflictException,
      );

      expect(upsertPlayerRatingMock).not.toHaveBeenCalled();
      expect(updateMatchMock).not.toHaveBeenCalled();
    });

    it('deve rejeitar partida com apenas um reporte', async () => {
      findUniqueMock.mockResolvedValue({
        id: matchId,
        status: 'AWAITING_VALIDATION',
        participants: [],
        resultReports: [{ winnerTeam: MatchTeam.COG }],
      });

      await expect(service.validateMatchResult(matchId)).rejects.toThrow(
        ConflictException,
      );

      expect(upsertPlayerRatingMock).not.toHaveBeenCalled();
      expect(updateMatchMock).not.toHaveBeenCalled();
    });

    it('deve homologar a partida e atualizar o ranking dos 8 jogadores', async () => {
      const participants = playerProfileIds.map((playerProfileId, index) => ({
        playerProfileId,
        team: index < 4 ? MatchTeam.COG : MatchTeam.LOCUST,
        playerProfile: {
          rating: {
            elo: 1000,
            wins: 0,
            losses: 0,
            matches: 0,
          },
        },
      }));

      findManyParticipantsMock.mockResolvedValue(
        participants.map(({ playerProfileId }) => ({ playerProfileId })),
      );

      findUniqueMock.mockResolvedValue({
        id: matchId,
        status: 'AWAITING_VALIDATION',
        participants,
        resultReports: [
          { captainId: playerProfileIds[0], winnerTeam: MatchTeam.COG },
          { captainId: playerProfileIds[4], winnerTeam: MatchTeam.COG },
        ],
      });

      upsertPlayerRatingMock.mockResolvedValue({});
      updateMatchMock.mockResolvedValue({
        id: matchId,
        status: 'COMPLETED',
        completedAt: new Date(),
      });

      const result = await service.validateMatchResult(matchId);

      expect(result.status).toBe('COMPLETED');
      expect(upsertPlayerRatingMock).toHaveBeenCalledTimes(8);

      for (const [index, playerProfileId] of playerProfileIds.entries()) {
        const won = index < 4;

        expect(upsertPlayerRatingMock).toHaveBeenCalledWith({
          where: { playerProfileId },
          create: {
            playerProfileId,
            elo: won ? 1016 : 984,
            wins: won ? 1 : 0,
            losses: won ? 0 : 1,
            matches: 1,
          },
          update: {
            elo: { increment: won ? 16 : -16 },
            wins: { increment: won ? 1 : 0 },
            losses: { increment: won ? 0 : 1 },
            matches: { increment: 1 },
          },
        });
      }

      expect(updateMatchMock).toHaveBeenCalledWith({
        where: { id: matchId },
        data: {
          status: 'COMPLETED',
          completedAt: expect.any(Date),
        },
      });

      // O bloqueio da partida e dos 8 jogadores ocorre antes
      // da leitura dos rankings.
      expect(queryRawMock).toHaveBeenCalledTimes(9);

      const lastLockOrder = queryRawMock.mock.invocationCallOrder[8];
      const matchReadOrder = findUniqueMock.mock.invocationCallOrder[0];

      expect(lastLockOrder).toBeLessThan(matchReadOrder);
    });

    it('não deve concluir a partida se a atualização do ranking falhar', async () => {
      const participants = playerProfileIds.map((playerProfileId, index) => ({
        playerProfileId,
        team: index < 4 ? MatchTeam.COG : MatchTeam.LOCUST,
        playerProfile: {
          rating: { elo: 1000 },
        },
      }));

      findManyParticipantsMock.mockResolvedValue(
        participants.map(({ playerProfileId }) => ({ playerProfileId })),
      );

      findUniqueMock.mockResolvedValue({
        id: matchId,
        status: 'AWAITING_VALIDATION',
        participants,
        resultReports: [
          { captainId: playerProfileIds[0], winnerTeam: MatchTeam.COG },
          { captainId: playerProfileIds[4], winnerTeam: MatchTeam.COG },
        ],
      });

      // Simula uma falha ao atualizar o quinto jogador.
      upsertPlayerRatingMock
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Falha no PostgreSQL'));

      await expect(service.validateMatchResult(matchId)).rejects.toThrow(
        'Falha no PostgreSQL',
      );

      expect(upsertPlayerRatingMock).toHaveBeenCalledTimes(5);

      // A partida não pode ser marcada como concluída.
      expect(updateMatchMock).not.toHaveBeenCalled();
    });
  });

  describe('submitDisputeEvidence', () => {
    const matchId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = 'captain-user-123';

    it('deve rejeitar referência de imagem vazia', async () => {
      await expect(
        service.submitDisputeEvidence(matchId, userId, ''),
      ).rejects.toThrow(BadRequestException);

      expect(transactionMock).not.toHaveBeenCalled();
      expect(createDisputeEvidenceMock).not.toHaveBeenCalled();
    });

    it('deve rejeitar referência contendo apenas espaços', async () => {
      await expect(
        service.submitDisputeEvidence(matchId, userId, '   '),
      ).rejects.toThrow(BadRequestException);

      expect(transactionMock).not.toHaveBeenCalled();
      expect(createDisputeEvidenceMock).not.toHaveBeenCalled();
    });

    it('deve rejeitar referência maior que 512 caracteres', async () => {
      await expect(
        service.submitDisputeEvidence(matchId, userId, 'a'.repeat(513)),
      ).rejects.toThrow(BadRequestException);

      expect(transactionMock).not.toHaveBeenCalled();
      expect(createDisputeEvidenceMock).not.toHaveBeenCalled();
    });

    it('deve retornar 404 quando a partida não existe', async () => {
      findUniqueMock.mockResolvedValue(null);

      await expect(
        service.submitDisputeEvidence(matchId, userId, 'disputes/evidence.png'),
      ).rejects.toThrow(NotFoundException);

      expect(createDisputeEvidenceMock).not.toHaveBeenCalled();
    });

    it('deve impedir jogadores que não são capitães', async () => {
      findUniqueMock.mockResolvedValue({
        status: 'DISPUTED',
        participants: [],
      });

      await expect(
        service.submitDisputeEvidence(matchId, userId, 'disputes/evidence.png'),
      ).rejects.toThrow(ForbiddenException);

      expect(createDisputeEvidenceMock).not.toHaveBeenCalled();
    });

    it('deve impedir evidências em partidas fora de disputa', async () => {
      findUniqueMock.mockResolvedValue({
        status: 'IN_PROGRESS',
        participants: [
          {
            playerProfileId: 'captain-profile-123',
          },
        ],
      });

      await expect(
        service.submitDisputeEvidence(matchId, userId, 'disputes/evidence.png'),
      ).rejects.toThrow(ConflictException);

      expect(createDisputeEvidenceMock).not.toHaveBeenCalled();
    });

    it('deve registrar a evidência vinculada ao capitão autenticado', async () => {
      const imageKey = 'disputes/evidence.png';
      const captainId = 'captain-profile-123';
      createDisputeEvidenceMock.mockResolvedValue({
        id: 'evidence-123',
        matchId,
        captainId,
        imageKey,
        createdAt: new Date(),
      });

      findUniqueMock.mockResolvedValue({
        status: 'DISPUTED',
        participants: [
          {
            playerProfileId: captainId,
          },
        ],
      });

      const result = await service.submitDisputeEvidence(
        matchId,
        userId,
        imageKey,
      );

      expect(queryRawMock).toHaveBeenCalledOnce();

      expect(findUniqueMock).toHaveBeenCalledWith({
        where: { id: matchId },
        select: {
          status: true,
          participants: {
            where: {
              isCaptain: true,
              playerProfile: { userId },
            },
            select: {
              playerProfileId: true,
            },
          },
        },
      });

      expect(createDisputeEvidenceMock).toHaveBeenCalledWith({
        data: {
          matchId,
          captainId,
          imageKey,
        },
      });

      expect(result).toEqual(
        expect.objectContaining({
          id: 'evidence-123',
          captainId,
          imageKey,
        }),
      );
    });

    it('deve propagar o erro quando a persistência falhar', async () => {
      const imageKey = 'disputes/evidence.png';

      findUniqueMock.mockResolvedValue({
        status: 'DISPUTED',
        participants: [
          {
            playerProfileId: 'captain-profile-123',
          },
        ],
      });

      createDisputeEvidenceMock.mockRejectedValue(
        new Error('Falha ao salvar evidência'),
      );

      await expect(
        service.submitDisputeEvidence(matchId, userId, imageKey),
      ).rejects.toThrow('Falha ao salvar evidência');

      expect(transactionMock).toHaveBeenCalledOnce();

      expect(createDisputeEvidenceMock).toHaveBeenCalledWith({
        data: {
          matchId,
          captainId: 'captain-profile-123',
          imageKey,
        },
      });
    });
  });

  describe('uploadDisputeEvidence', () => {
    const matchId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = 'captain-user-123';
    const imageKey = '550e8400-e29b-41d4-a716-446655440001.png';
    const file = Buffer.from('imagem-de-teste');

    const disputedMatch = {
      status: 'DISPUTED',
      participants: [
        {
          playerProfileId: 'captain-profile-123',
        },
      ],
    };

    it('deve salvar e registrar a evidência de um capitão autorizado', async () => {
      findUniqueMock.mockResolvedValue(disputedMatch);

      const result = await service.uploadDisputeEvidence(matchId, userId, file);

      expect(saveEvidenceMock).toHaveBeenCalledWith(file);

      expect(createDisputeEvidenceMock).toHaveBeenCalledWith({
        data: {
          matchId,
          captainId: 'captain-profile-123',
          imageKey,
        },
      });

      expect(result).toMatchObject({
        imageKey,
      });

      expect(removeEvidenceMock).not.toHaveBeenCalled();
    });

    it('não deve salvar arquivos de jogadores não autorizados', async () => {
      findUniqueMock.mockResolvedValue({
        status: 'DISPUTED',
        participants: [],
      });

      await expect(
        service.uploadDisputeEvidence(matchId, userId, file),
      ).rejects.toThrow(ForbiddenException);

      expect(saveEvidenceMock).not.toHaveBeenCalled();
      expect(createDisputeEvidenceMock).not.toHaveBeenCalled();
    });

    it('não deve salvar arquivos de partidas fora de disputa', async () => {
      findUniqueMock.mockResolvedValue({
        ...disputedMatch,
        status: 'IN_PROGRESS',
      });

      await expect(
        service.uploadDisputeEvidence(matchId, userId, file),
      ).rejects.toThrow(ConflictException);

      expect(saveEvidenceMock).not.toHaveBeenCalled();
    });

    it('deve remover o arquivo quando o banco falhar', async () => {
      findUniqueMock.mockResolvedValue(disputedMatch);

      createDisputeEvidenceMock.mockRejectedValue(
        new Error('Falha no PostgreSQL'),
      );

      await expect(
        service.uploadDisputeEvidence(matchId, userId, file),
      ).rejects.toThrow('Falha no PostgreSQL');

      expect(saveEvidenceMock).toHaveBeenCalledWith(file);
      expect(removeEvidenceMock).toHaveBeenCalledWith(imageKey);
    });

    it('deve remover o arquivo se a partida mudar de status', async () => {
      findUniqueMock
        .mockResolvedValueOnce(disputedMatch)
        .mockResolvedValueOnce({
          ...disputedMatch,
          status: 'COMPLETED',
        });

      await expect(
        service.uploadDisputeEvidence(matchId, userId, file),
      ).rejects.toThrow(ConflictException);

      expect(saveEvidenceMock).toHaveBeenCalledWith(file);
      expect(removeEvidenceMock).toHaveBeenCalledWith(imageKey);
      expect(createDisputeEvidenceMock).not.toHaveBeenCalled();
    });
  });

  describe('getDisputeEvidenceImage', () => {
    const matchId = '550e8400-e29b-41d4-a716-446655440000';
    const evidenceId = '550e8400-e29b-41d4-a716-446655440002';
    const userId = 'user-123';
    const imageKey = '550e8400-e29b-41d4-a716-446655440001.png';

    const evidence = { imageKey };

    it('deve permitir que um participante visualize a evidência', async () => {
      findFirstDisputeEvidenceMock.mockResolvedValue(evidence);
      findFirstParticipantMock.mockResolvedValue({
        id: 'participant-123',
      });

      const result = await service.getDisputeEvidenceImage(
        matchId,
        evidenceId,
        userId,
      );

      expect(result).toEqual(Buffer.from('imagem-privada'));

      expect(findFirstDisputeEvidenceMock).toHaveBeenCalledWith({
        where: {
          id: evidenceId,
          matchId,
        },
        select: {
          imageKey: true,
        },
      });

      expect(readEvidenceMock).toHaveBeenCalledExactlyOnceWith(imageKey);
    });

    it('deve impedir jogadores que não participam da partida', async () => {
      findFirstDisputeEvidenceMock.mockResolvedValue(evidence);
      findFirstParticipantMock.mockResolvedValue(null);

      await expect(
        service.getDisputeEvidenceImage(matchId, evidenceId, userId),
      ).rejects.toThrow(ForbiddenException);

      expect(readEvidenceMock).not.toHaveBeenCalled();
    });

    it('deve permitir que um administrador visualize a evidência', async () => {
      findFirstDisputeEvidenceMock.mockResolvedValue(evidence);

      const result = await service.getDisputeEvidenceImage(
        matchId,
        evidenceId,
        'admin-user-123',
        true,
      );

      expect(result).toEqual(Buffer.from('imagem-privada'));
      expect(findFirstMock).not.toHaveBeenCalled();
      expect(readEvidenceMock).toHaveBeenCalledWith(imageKey);
    });

    it('deve retornar 404 quando a evidência não existe', async () => {
      findFirstDisputeEvidenceMock.mockResolvedValue(null);

      await expect(
        service.getDisputeEvidenceImage(matchId, evidenceId, userId),
      ).rejects.toThrow(NotFoundException);

      expect(readEvidenceMock).not.toHaveBeenCalled();
    });
  });

  describe('resolveDispute', () => {
    const disputeInput = {
      matchId: 'match-123',
      adminId: 'admin-123',
      winnerTeam: MatchTeam.COG,
      reason: 'Os oito jogadores foram conferidos nas evidências.',
      evidenceIds: ['evidence-123'],
      gamertagsVerified: true,
    };

    it('deve registrar a decisão e atualizar o ranking dos 8 jogadores', async () => {
      const participants = playerProfileIds.map((playerProfileId, index) => ({
        playerProfileId,
        team: index < 4 ? MatchTeam.COG : MatchTeam.LOCUST,
        playerProfile: {
          gamertag: `Gamertag${index + 1}`,
          rating: {
            elo: 1000,
          },
        },
      }));

      findManyParticipantsMock.mockResolvedValue(
        participants.map(({ playerProfileId }) => ({ playerProfileId })),
      );

      findUniqueMock.mockResolvedValue({
        id: disputeInput.matchId,
        status: 'DISPUTED',
        participants,
      });

      findManyDisputeEvidenceMock.mockResolvedValue([{ id: 'evidence-123' }]);

      upsertPlayerRatingMock.mockResolvedValue({});
      updateMatchMock.mockResolvedValue({});

      const result = await service.resolveDispute(disputeInput);

      expect(createDisputeResolutionMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          matchId: disputeInput.matchId,
          adminId: disputeInput.adminId,
          winnerTeam: MatchTeam.COG,
          evidenceIds: ['evidence-123'],
          gamertagsVerified: true,
        }),
      });

      expect(upsertPlayerRatingMock).toHaveBeenCalledTimes(8);

      expect(updateMatchMock).toHaveBeenCalledWith({
        where: { id: disputeInput.matchId },
        data: expect.objectContaining({
          status: 'COMPLETED',
          completedAt: expect.any(Date),
        }),
      });

      expect(result.id).toBe('resolution-123');
    });

    it('deve impedir a resolução de uma partida já concluída', async () => {
      findManyParticipantsMock.mockResolvedValue(
        playerProfileIds.map((playerProfileId) => ({
          playerProfileId,
        })),
      );

      findUniqueMock.mockResolvedValue({
        id: disputeInput.matchId,
        status: 'COMPLETED',
        participants: [],
      });

      await expect(service.resolveDispute(disputeInput)).rejects.toThrow(
        ConflictException,
      );

      expect(createDisputeResolutionMock).not.toHaveBeenCalled();
      expect(upsertPlayerRatingMock).not.toHaveBeenCalled();
      expect(updateMatchMock).not.toHaveBeenCalled();
    });

    it('deve rejeitar evidências que não pertencem à partida', async () => {
      const participants = playerProfileIds.map((playerProfileId, index) => ({
        playerProfileId,
        team: index < 4 ? MatchTeam.COG : MatchTeam.LOCUST,
        playerProfile: {
          gamertag: `Gamertag${index + 1}`,
          rating: { elo: 1000 },
        },
      }));

      findManyParticipantsMock.mockResolvedValue(
        participants.map(({ playerProfileId }) => ({ playerProfileId })),
      );

      findUniqueMock.mockResolvedValue({
        id: disputeInput.matchId,
        status: 'DISPUTED',
        participants,
      });

      // Simula uma evidência inexistente ou de outra partida.
      findManyDisputeEvidenceMock.mockResolvedValue([]);

      await expect(service.resolveDispute(disputeInput)).rejects.toThrow(
        BadRequestException,
      );

      expect(findManyDisputeEvidenceMock).toHaveBeenCalledWith({
        where: {
          matchId: disputeInput.matchId,
          id: { in: disputeInput.evidenceIds },
        },
        select: { id: true },
      });

      expect(createDisputeResolutionMock).not.toHaveBeenCalled();
      expect(upsertPlayerRatingMock).not.toHaveBeenCalled();
      expect(updateMatchMock).not.toHaveBeenCalled();
    });

    it('deve impedir a resolução sem confirmação das oito gamertags', async () => {
      await expect(
        service.resolveDispute({
          ...disputeInput,
          gamertagsVerified: false,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(transactionMock).not.toHaveBeenCalled();
      expect(createDisputeResolutionMock).not.toHaveBeenCalled();
      expect(upsertPlayerRatingMock).not.toHaveBeenCalled();
      expect(updateMatchMock).not.toHaveBeenCalled();
    });
  });

  describe('listPendingDisputes', () => {
    it('deve consultar somente disputas pendentes, em ordem e com limite', async () => {
      findManyMatchesMock.mockResolvedValue([]);

      const result = await service.listPendingDisputes();

      expect(result).toEqual([]);

      expect(findManyMatchesMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: 'DISPUTED',
        },
        select: {
          id: true,
          mode: true,
          region: true,
          status: true,
          createdAt: true,
          startedAt: true,
          updatedAt: true,
          _count: {
            select: {
              participants: true,
              resultReports: true,
              disputeEvidences: true,
            },
          },
        },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: 50,
      });
    });

    it('deve retornar os dados necessários sem expor informações sensíveis', async () => {
      const createdAt = new Date('2026-10-15T12:00:00.000Z');
      const updatedAt = new Date('2026-10-16T12:00:00.000Z');

      findManyMatchesMock.mockResolvedValue([
        {
          id: 'match-123',
          mode: 'DEMOLITION',
          region: 'BR',
          status: 'DISPUTED',
          createdAt,
          startedAt: createdAt,
          updatedAt,
          _count: {
            participants: 8,
            resultReports: 2,
            disputeEvidences: 2,
          },
        },
      ]);

      const result = await service.listPendingDisputes();

      expect(result).toEqual([
        {
          id: 'match-123',
          mode: 'DEMOLITION',
          region: 'BR',
          status: 'DISPUTED',
          createdAt,
          startedAt: createdAt,
          updatedAt,
          participantsCount: 8,
          reportsCount: 2,
          evidencesCount: 2,
        },
      ]);

      expect(result[0]).not.toHaveProperty('imageKey');
      expect(result[0]).not.toHaveProperty('_count');
    });
  });
});
