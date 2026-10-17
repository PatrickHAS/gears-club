import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';

import { MatchesController } from './matches.controller.js';
import { MatchesService } from './matches.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { MatchTeam, UserRole } from '@prisma/client';
import { AdminGuard } from '../auth/guards/admin.guard.js';

describe('MatchesController', () => {
  let controller: MatchesController;

  const getMatchByIdMock = vi.fn();
  const startMatchMock = vi.fn();
  const reportResultMock = vi.fn();
  const validateMatchResultMock = vi.fn();
  const uploadDisputeEvidenceMock = vi.fn();
  const getDisputeEvidenceImageMock = vi.fn();

  beforeEach(async () => {
    vi.resetAllMocks();

    const module = await Test.createTestingModule({
      controllers: [MatchesController],
      providers: [
        {
          provide: MatchesService,
          useValue: {
            getMatchById: getMatchByIdMock,
            startMatch: startMatchMock,
            reportResult: reportResultMock,
            validateMatchResult: validateMatchResultMock,
            uploadDisputeEvidence: uploadDisputeEvidenceMock,
            getDisputeEvidenceImage: getDisputeEvidenceImageMock,
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: vi.fn().mockReturnValue(true),
      })
      .compile();

    controller = module.get(MatchesController);
  });

  it('deve consultar a partida usando o ID do usuário autenticado', async () => {
    const matchId = '550e8400-e29b-41d4-a716-446655440000';

    const request = {
      user: {
        id: 'user-123',
      },
    };

    const match = {
      id: matchId,
      status: 'PENDING',
      region: 'BR',
    };

    getMatchByIdMock.mockResolvedValue(match);

    const result = await controller.getMatchById(
      matchId,
      request as Parameters<MatchesController['getMatchById']>[1],
    );

    expect(result).toEqual(match);

    expect(getMatchByIdMock).toHaveBeenCalledExactlyOnceWith(
      matchId,
      'user-123',
    );
  });

  it('deve estar protegido pelo JwtAuthGuard', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      MatchesController,
    ) as unknown[];

    expect(guards).toContain(JwtAuthGuard);
  });

  it('deve iniciar a partida usando o usuário autenticado', async () => {
    const matchId = '550e8400-e29b-41d4-a716-446655440000';

    const request = {
      user: {
        id: 'captain-user-123',
      },
    };

    const startedMatch = {
      id: matchId,
      status: 'IN_PROGRESS',
      region: 'BR',
      startedAt: new Date(),
    };

    startMatchMock.mockResolvedValue(startedMatch);

    const result = await controller.startMatch(
      matchId,
      request as Parameters<MatchesController['startMatch']>[1],
    );

    expect(result).toEqual(startedMatch);

    expect(startMatchMock).toHaveBeenCalledExactlyOnceWith(
      matchId,
      'captain-user-123',
    );
  });

  it('deve reportar o resultado usando o usuário autenticado', async () => {
    const matchId = '550e8400-e29b-41d4-a716-446655440000';

    const request = {
      user: {
        id: 'captain-user-123',
      },
    };

    const report = {
      id: 'report-123',
      matchId,
      captainId: 'captain-profile-123',
      winnerTeam: MatchTeam.COG,
    };

    reportResultMock.mockResolvedValue(report);

    const result = await controller.reportResult(
      matchId,
      MatchTeam.COG,
      request as Parameters<MatchesController['reportResult']>[2],
    );

    expect(result).toEqual(report);

    expect(reportResultMock).toHaveBeenCalledExactlyOnceWith(
      matchId,
      'captain-user-123',
      MatchTeam.COG,
    );
  });

  it('deve exigir AdminGuard para homologar partidas', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      MatchesController.prototype.validateMatchResult,
    ) as unknown[];

    expect(guards).toContain(AdminGuard);
  });

  it('deve utilizar a rota :id/validate para homologação', () => {
    const path = Reflect.getMetadata(
      PATH_METADATA,
      MatchesController.prototype.validateMatchResult,
    );

    expect(path).toBe(':id/validate');
  });

  it('deve chamar o serviço para homologar a partida', async () => {
    const matchId = '550e8400-e29b-41d4-a716-446655440000';

    const validatedMatch = {
      id: matchId,
      status: 'COMPLETED',
      completedAt: new Date(),
    };

    validateMatchResultMock.mockResolvedValue(validatedMatch);

    const result = await controller.validateMatchResult(matchId);

    expect(result).toEqual(validatedMatch);

    expect(validateMatchResultMock).toHaveBeenCalledExactlyOnceWith(matchId);
  });

  describe('uploadDisputeEvidence', () => {
    const matchId = '550e8400-e29b-41d4-a716-446655440000';

    const request = {
      user: {
        id: 'captain-user-123',
      },
    } as Parameters<MatchesController['uploadDisputeEvidence']>[1];

    it('deve enviar a imagem usando o usuário autenticado', async () => {
      const buffer = Buffer.from('imagem-de-teste');

      const file = {
        buffer,
        originalname: 'print.png',
        mimetype: 'image/png',
      } as Express.Multer.File;

      const evidence = {
        id: 'evidence-123',
        matchId,
        imageKey: '550e8400-e29b-41d4-a716-446655440001.png',
      };

      uploadDisputeEvidenceMock.mockResolvedValue(evidence);

      const result = await controller.uploadDisputeEvidence(
        matchId,
        request,
        file,
      );

      expect(result).toEqual(evidence);

      expect(uploadDisputeEvidenceMock).toHaveBeenCalledExactlyOnceWith(
        matchId,
        'captain-user-123',
        buffer,
      );
    });

    it('deve rejeitar requisições sem arquivo', async () => {
      await expect(
        controller.uploadDisputeEvidence(matchId, request, undefined),
      ).rejects.toThrow('Envie uma imagem no campo file.');

      expect(uploadDisputeEvidenceMock).not.toHaveBeenCalled();
    });

    it('deve rejeitar arquivos vazios', async () => {
      const file = {
        buffer: Buffer.alloc(0),
      } as Express.Multer.File;

      await expect(
        controller.uploadDisputeEvidence(matchId, request, file),
      ).rejects.toThrow('Envie uma imagem no campo file.');

      expect(uploadDisputeEvidenceMock).not.toHaveBeenCalled();
    });

    it('deve utilizar a rota :id/dispute-evidences', () => {
      const path = Reflect.getMetadata(
        PATH_METADATA,
        MatchesController.prototype.uploadDisputeEvidence,
      ) as string;

      expect(path).toBe(':id/dispute-evidences');
    });
  });

  describe('getDisputeEvidenceImage', () => {
    const matchId = '550e8400-e29b-41d4-a716-446655440000';
    const evidenceId = '550e8400-e29b-41d4-a716-446655440002';

    function createResponseMock() {
      return {
        setHeader: vi.fn(),
      };
    }

    it('deve permitir a leitura usando a identidade do jogador autenticado', async () => {
      const image = Buffer.from('imagem-privada');
      getDisputeEvidenceImageMock.mockResolvedValue(image);

      const request = {
        user: {
          id: 'player-123',
          role: UserRole.USER,
        },
      };

      const response = createResponseMock();

      const result = await controller.getDisputeEvidenceImage(
        matchId,
        evidenceId,
        request as Parameters<MatchesController['getDisputeEvidenceImage']>[2],
        response as unknown as Parameters<
          MatchesController['getDisputeEvidenceImage']
        >[3],
      );

      expect(getDisputeEvidenceImageMock).toHaveBeenCalledExactlyOnceWith(
        matchId,
        evidenceId,
        'player-123',
        false,
      );

      const chunks: Buffer[] = [];

      for await (const chunk of result.getStream()) {
        chunks.push(Buffer.from(chunk));
      }

      expect(Buffer.concat(chunks)).toEqual(image);
      expect(response.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'image/png',
      );
      expect(response.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'private, no-store',
      );
      expect(response.setHeader).toHaveBeenCalledWith(
        'X-Content-Type-Options',
        'nosniff',
      );
    });

    it('deve reconhecer administradores pelo papel autenticado', async () => {
      getDisputeEvidenceImageMock.mockResolvedValue(Buffer.from('imagem'));

      const request = {
        user: {
          id: 'admin-123',
          role: UserRole.ADMIN,
        },
      };

      await controller.getDisputeEvidenceImage(
        matchId,
        evidenceId,
        request as Parameters<MatchesController['getDisputeEvidenceImage']>[2],
        createResponseMock() as unknown as Parameters<
          MatchesController['getDisputeEvidenceImage']
        >[3],
      );

      expect(getDisputeEvidenceImageMock).toHaveBeenCalledExactlyOnceWith(
        matchId,
        evidenceId,
        'admin-123',
        true,
      );
    });

    it('não deve aceitar privilégios administrativos enviados pelo cliente', async () => {
      getDisputeEvidenceImageMock.mockResolvedValue(Buffer.from('imagem'));

      const request = {
        user: {
          id: 'player-123',
          role: UserRole.USER,
        },
        query: {
          isAdmin: 'true',
        },
        body: {
          role: UserRole.ADMIN,
        },
      };

      await controller.getDisputeEvidenceImage(
        matchId,
        evidenceId,
        request as unknown as Parameters<
          MatchesController['getDisputeEvidenceImage']
        >[2],
        createResponseMock() as unknown as Parameters<
          MatchesController['getDisputeEvidenceImage']
        >[3],
      );

      expect(getDisputeEvidenceImageMock).toHaveBeenCalledWith(
        matchId,
        evidenceId,
        'player-123',
        false,
      );
    });

    it('deve utilizar a rota privada de visualização', () => {
      const path = Reflect.getMetadata(
        PATH_METADATA,
        MatchesController.prototype.getDisputeEvidenceImage,
      );

      expect(path).toBe(':id/dispute-evidences/:evidenceId/image');
    });
  });
});
