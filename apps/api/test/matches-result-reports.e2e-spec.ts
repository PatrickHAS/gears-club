import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { MatchTeam } from '@prisma/client';
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

describe('POST /matches/:id/result-reports (E2E)', () => {
  let app: INestApplication;

  const matchId = '550e8400-e29b-41d4-a716-446655440000';
  const userId = 'authenticated-user-123';

  const reportResultMock = vi.fn();
  const verifyAsyncMock = vi.fn();
  const findUniqueUserMock = vi.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MatchesController],
      providers: [
        JwtAuthGuard,
        {
          provide: MatchesService,
          useValue: {
            reportResult: reportResultMock,
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
    });

    reportResultMock.mockResolvedValue({
      id: 'report-123',
      matchId,
      winnerTeam: MatchTeam.COG,
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
});
