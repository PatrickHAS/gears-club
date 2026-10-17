import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { MatchTeam, UserRole } from '@prisma/client';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { MatchesController } from '../src/matches/matches.controller.js';
import { MatchesService } from '../src/matches/matches.service.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { AdminGuard } from '../src/auth/guards/admin.guard.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('PATCH /matches/:id/resolve-dispute (E2E)', () => {
  let app: INestApplication;

  const matchId = '550e8400-e29b-41d4-a716-446655440000';
  const adminId = 'admin-user-123';
  const evidenceId = '550e8400-e29b-41d4-a716-446655440001';

  const resolveDisputeMock = vi.fn();
  const getDisputeReviewMock = vi.fn();
  const listPendingDisputesMock = vi.fn();
  const verifyAsyncMock = vi.fn();
  const findUniqueUserMock = vi.fn();

  const validBody = {
    winnerTeam: MatchTeam.COG,
    reason: 'As oito gamertags foram conferidas nas evidências.',
    evidenceIds: [evidenceId],
    gamertagsVerified: true,
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MatchesController],
      providers: [
        JwtAuthGuard,
        AdminGuard,
        {
          provide: MatchesService,
          useValue: {
            resolveDispute: resolveDisputeMock,
            getDisputeReview: getDisputeReviewMock,
            listPendingDisputes: listPendingDisputesMock,
          },
        },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: verifyAsyncMock,
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: findUniqueUserMock,
            },
          },
        },
      ],
    }).compile();

    getDisputeReviewMock.mockResolvedValue({
      id: matchId,
      mode: 'DEMOLITION',
      region: 'BR',
      status: 'DISPUTED',
      participants: [
        {
          playerProfileId: 'profile-1',
          gamertag: 'PlayerCOG',
          country: 'BR',
          team: MatchTeam.COG,
          isCaptain: true,
        },
        {
          playerProfileId: 'profile-2',
          gamertag: 'PlayerLOCUST',
          country: 'BR',
          team: MatchTeam.LOCUST,
          isCaptain: true,
        },
      ],
      resultReports: [],
      disputeEvidences: [
        {
          id: evidenceId,
          captainId: 'profile-1',
        },
      ],
    });

    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    listPendingDisputesMock.mockResolvedValue([
      {
        id: matchId,
        mode: 'DEMOLITION',
        region: 'BR',
        status: 'DISPUTED',
        participantsCount: 8,
        reportsCount: 2,
        evidencesCount: 1,
      },
    ]);

    verifyAsyncMock.mockResolvedValue({ sub: adminId });

    findUniqueUserMock.mockResolvedValue({
      id: adminId,
      username: 'test-admin',
      email: 'admin@example.test',
      role: UserRole.ADMIN,
    });

    resolveDisputeMock.mockResolvedValue({
      id: 'resolution-123',
      matchId,
      adminId,
      winnerTeam: MatchTeam.COG,
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('deve rejeitar requisição sem JWT', async () => {
    await request(app.getHttpServer())
      .patch(`/matches/${matchId}/resolve-dispute`)
      .send(validBody)
      .expect(401);

    expect(resolveDisputeMock).not.toHaveBeenCalled();
  });

  it('deve impedir jogador comum de resolver disputas', async () => {
    findUniqueUserMock.mockResolvedValue({
      id: adminId,
      username: 'test-player',
      email: 'player@example.test',
      role: UserRole.USER,
    });

    await request(app.getHttpServer())
      .patch(`/matches/${matchId}/resolve-dispute`)
      .set('Authorization', 'Bearer valid-test-token')
      .send(validBody)
      .expect(403);

    expect(resolveDisputeMock).not.toHaveBeenCalled();
  });

  it('deve rejeitar UUID de partida inválido', async () => {
    await request(app.getHttpServer())
      .patch('/matches/invalid-id/resolve-dispute')
      .set('Authorization', 'Bearer valid-test-token')
      .send(validBody)
      .expect(400);

    expect(resolveDisputeMock).not.toHaveBeenCalled();
  });

  it('deve rejeitar equipe vencedora inválida', async () => {
    await request(app.getHttpServer())
      .patch(`/matches/${matchId}/resolve-dispute`)
      .set('Authorization', 'Bearer valid-test-token')
      .send({
        ...validBody,
        winnerTeam: 'INVALID_TEAM',
      })
      .expect(400);

    expect(resolveDisputeMock).not.toHaveBeenCalled();
  });

  it.each([
    ['justificativa muito curta', { reason: 'Curta' }],
    ['justificativa ausente', { reason: undefined }],
    ['lista de evidências vazia', { evidenceIds: [] }],
    ['evidência com UUID inválido', { evidenceIds: ['invalid-id'] }],
    ['evidências duplicadas', { evidenceIds: [evidenceId, evidenceId] }],
    ['confirmação de gamertags falsa', { gamertagsVerified: false }],
    ['confirmação de gamertags ausente', { gamertagsVerified: undefined }],
    ['campo adicional não permitido', { unexpectedField: 'invalid' }],
  ])('deve rejeitar %s', async (_description, invalidFields) => {
    await request(app.getHttpServer())
      .patch(`/matches/${matchId}/resolve-dispute`)
      .set('Authorization', 'Bearer valid-test-token')
      .send({
        ...validBody,
        ...invalidFields,
      })
      .expect(400);

    expect(resolveDisputeMock).not.toHaveBeenCalled();
  });

  it('deve permitir resolução por administrador', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/matches/${matchId}/resolve-dispute`)
      .set('Authorization', 'Bearer valid-test-token')
      .send(validBody)
      .expect(200);

    expect(response.body).toEqual({
      id: 'resolution-123',
      matchId,
      adminId,
      winnerTeam: MatchTeam.COG,
    });

    expect(resolveDisputeMock).toHaveBeenCalledExactlyOnceWith({
      matchId,
      adminId,
      ...validBody,
    });
  });

  describe('GET /matches/:id/dispute-review', () => {
    it('deve rejeitar acesso sem autenticação', async () => {
      await request(app.getHttpServer())
        .get(`/matches/${matchId}/dispute-review`)
        .expect(401);

      expect(getDisputeReviewMock).not.toHaveBeenCalled();
    });

    it('deve impedir acesso de jogador comum', async () => {
      findUniqueUserMock.mockResolvedValue({
        id: adminId,
        username: 'test-player',
        email: 'player@example.test',
        role: UserRole.USER,
      });

      await request(app.getHttpServer())
        .get(`/matches/${matchId}/dispute-review`)
        .set('Authorization', 'Bearer valid-test-token')
        .expect(403);

      expect(getDisputeReviewMock).not.toHaveBeenCalled();
    });

    it('deve rejeitar UUID inválido', async () => {
      await request(app.getHttpServer())
        .get('/matches/invalid-id/dispute-review')
        .set('Authorization', 'Bearer valid-test-token')
        .expect(400);

      expect(getDisputeReviewMock).not.toHaveBeenCalled();
    });

    it('deve permitir que administrador consulte a disputa', async () => {
      const response = await request(app.getHttpServer())
        .get(`/matches/${matchId}/dispute-review`)
        .set('Authorization', 'Bearer valid-test-token')
        .expect(200);

      expect(getDisputeReviewMock).toHaveBeenCalledExactlyOnceWith(matchId);

      expect(response.body).toMatchObject({
        id: matchId,
        status: 'DISPUTED',
        region: 'BR',
      });

      expect(response.body.participants).toHaveLength(2);
      expect(response.body.disputeEvidences).toHaveLength(1);

      expect(JSON.stringify(response.body)).not.toContain('imageKey');
    });
  });

  describe('GET /matches/admin/disputes', () => {
    it('deve rejeitar acesso sem autenticação', async () => {
      await request(app.getHttpServer())
        .get('/matches/admin/disputes')
        .expect(401);

      expect(listPendingDisputesMock).not.toHaveBeenCalled();
    });

    it('deve impedir acesso de jogador comum', async () => {
      findUniqueUserMock.mockResolvedValue({
        id: adminId,
        username: 'test-player',
        email: 'player@example.test',
        role: UserRole.USER,
      });

      await request(app.getHttpServer())
        .get('/matches/admin/disputes')
        .set('Authorization', 'Bearer valid-test-token')
        .expect(403);

      expect(listPendingDisputesMock).not.toHaveBeenCalled();
    });

    it('deve permitir que administrador liste as disputas', async () => {
      const response = await request(app.getHttpServer())
        .get('/matches/admin/disputes')
        .set('Authorization', 'Bearer valid-test-token')
        .expect(200);

      expect(listPendingDisputesMock).toHaveBeenCalledOnce();

      expect(response.body).toEqual([
        {
          id: matchId,
          mode: 'DEMOLITION',
          region: 'BR',
          status: 'DISPUTED',
          participantsCount: 8,
          reportsCount: 2,
          evidencesCount: 1,
        },
      ]);
    });
  });
});
