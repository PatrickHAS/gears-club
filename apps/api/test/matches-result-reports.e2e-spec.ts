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
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AdminGuard } from '../src/auth/guards/admin.guard.js';

describe('POST /matches/:id/result-reports (E2E)', () => {
  let app: INestApplication;

  const matchId = '550e8400-e29b-41d4-a716-446655440000';
  const userId = 'authenticated-user-123';

  const reportResultMock = vi.fn();
  const validateMatchResultMock = vi.fn();
  const verifyAsyncMock = vi.fn();
  const findUniqueUserMock = vi.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MatchesController],
      providers: [
        JwtAuthGuard,
        AdminGuard,
        {
          provide: MatchesService,
          useValue: {
            reportResult: reportResultMock,
            validateMatchResult: validateMatchResultMock,
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

    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    verifyAsyncMock.mockResolvedValue({ sub: userId });

    findUniqueUserMock.mockResolvedValue({
      id: userId,
      username: 'test-captain',
      email: 'captain@example.test',
      role: UserRole.USER,
    });

    reportResultMock.mockResolvedValue({
      id: 'report-123',
      matchId,
      winnerTeam: MatchTeam.COG,
    });

    validateMatchResultMock.mockResolvedValue({
      id: matchId,
      status: 'COMPLETED',
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('deve rejeitar requisição sem token JWT', async () => {
    await request(app.getHttpServer())
      .post(`/matches/${matchId}/result-reports`)
      .send({ winnerTeam: MatchTeam.COG })
      .expect(401);

    expect(reportResultMock).not.toHaveBeenCalled();
  });

  it('deve rejeitar UUID inválido', async () => {
    await request(app.getHttpServer())
      .post('/matches/invalid-id/result-reports')
      .set('Authorization', 'Bearer valid-test-token')
      .send({ winnerTeam: MatchTeam.COG })
      .expect(400);

    expect(reportResultMock).not.toHaveBeenCalled();
  });

  it('deve rejeitar vencedor inválido', async () => {
    await request(app.getHttpServer())
      .post(`/matches/${matchId}/result-reports`)
      .set('Authorization', 'Bearer valid-test-token')
      .send({ winnerTeam: 'INVALID_TEAM' })
      .expect(400);

    expect(reportResultMock).not.toHaveBeenCalled();
  });

  it('deve aceitar um reporte válido do usuário autenticado', async () => {
    const response = await request(app.getHttpServer())
      .post(`/matches/${matchId}/result-reports`)
      .set('Authorization', 'Bearer valid-test-token')
      .send({ winnerTeam: MatchTeam.COG })
      .expect(201);

    expect(response.body).toEqual({
      id: 'report-123',
      matchId,
      winnerTeam: MatchTeam.COG,
    });

    expect(verifyAsyncMock).toHaveBeenCalledWith('valid-test-token');

    expect(reportResultMock).toHaveBeenCalledExactlyOnceWith(
      matchId,
      userId,
      MatchTeam.COG,
    );
  });

  it('deve rejeitar homologação sem token JWT', async () => {
    await request(app.getHttpServer())
      .patch(`/matches/${matchId}/validate`)
      .expect(401);

    expect(validateMatchResultMock).not.toHaveBeenCalled();
  });

  it('deve impedir jogador comum de homologar partidas', async () => {
    await request(app.getHttpServer())
      .patch(`/matches/${matchId}/validate`)
      .set('Authorization', 'Bearer valid-test-token')
      .expect(403);

    expect(validateMatchResultMock).not.toHaveBeenCalled();
  });

  it('deve permitir homologação por administrador', async () => {
    findUniqueUserMock.mockResolvedValue({
      id: userId,
      username: 'test-admin',
      email: 'admin@example.test',
      role: UserRole.ADMIN,
    });

    const response = await request(app.getHttpServer())
      .patch(`/matches/${matchId}/validate`)
      .set('Authorization', 'Bearer valid-test-token')
      .expect(200);

    expect(response.body).toEqual({
      id: matchId,
      status: 'COMPLETED',
    });

    expect(validateMatchResultMock).toHaveBeenCalledExactlyOnceWith(matchId);
  });

  it('deve rejeitar UUID inválido na homologação', async () => {
    findUniqueUserMock.mockResolvedValue({
      id: userId,
      username: 'test-admin',
      email: 'admin@example.test',
      role: UserRole.ADMIN,
    });

    await request(app.getHttpServer())
      .patch('/matches/invalid-id/validate')
      .set('Authorization', 'Bearer valid-test-token')
      .expect(400);

    expect(validateMatchResultMock).not.toHaveBeenCalled();
  });
});
