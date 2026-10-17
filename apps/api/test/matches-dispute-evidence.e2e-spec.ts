import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
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

describe('POST /matches/:id/dispute-evidences (E2E)', () => {
  let app: INestApplication;

  const matchId = '550e8400-e29b-41d4-a716-446655440000';
  const userId = 'authenticated-user-123';

  const uploadDisputeEvidenceMock = vi.fn();
  const getDisputeEvidenceImageMock = vi.fn();
  const verifyAsyncMock = vi.fn();
  const findUniqueUserMock = vi.fn();

  const validPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=',
    'base64',
  );

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MatchesController],
      providers: [
        JwtAuthGuard,
        {
          provide: MatchesService,
          useValue: {
            uploadDisputeEvidence: uploadDisputeEvidenceMock,
            getDisputeEvidenceImage: getDisputeEvidenceImageMock,
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

    uploadDisputeEvidenceMock.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440002',
      matchId,
      captainId: 'captain-profile-123',
      imageKey: '550e8400-e29b-41d4-a716-446655440001.png',
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('deve rejeitar upload sem autenticação JWT', async () => {
    await request(app.getHttpServer())
      .post(`/matches/${matchId}/dispute-evidences`)
      .attach('file', validPng, 'evidencia.png')
      .expect(401);

    expect(uploadDisputeEvidenceMock).not.toHaveBeenCalled();
  });

  it('deve rejeitar upload sem arquivo', async () => {
    await request(app.getHttpServer())
      .post(`/matches/${matchId}/dispute-evidences`)
      .set('Authorization', 'Bearer valid-test-token')
      .expect(400);

    expect(uploadDisputeEvidenceMock).not.toHaveBeenCalled();
  });

  it('deve rejeitar UUID inválido', async () => {
    await request(app.getHttpServer())
      .post('/matches/invalid-id/dispute-evidences')
      .set('Authorization', 'Bearer valid-test-token')
      .attach('file', validPng, 'evidencia.png')
      .expect(400);

    expect(uploadDisputeEvidenceMock).not.toHaveBeenCalled();
  });

  it('deve aceitar uma imagem enviada pelo usuário autenticado', async () => {
    const response = await request(app.getHttpServer())
      .post(`/matches/${matchId}/dispute-evidences`)
      .set('Authorization', 'Bearer valid-test-token')
      .attach('file', validPng, 'evidencia.png')
      .expect(201);

    expect(response.body.matchId).toBe(matchId);

    expect(uploadDisputeEvidenceMock).toHaveBeenCalledExactlyOnceWith(
      matchId,
      userId,
      expect.any(Buffer),
    );

    const uploadedBuffer = uploadDisputeEvidenceMock.mock.calls[0]?.[2];

    expect(uploadedBuffer).toEqual(validPng);
  });

  it('deve rejeitar arquivos maiores que 5 MB', async () => {
    const oversizedFile = Buffer.alloc(5 * 1024 * 1024 + 1);

    await request(app.getHttpServer())
      .post(`/matches/${matchId}/dispute-evidences`)
      .set('Authorization', 'Bearer valid-test-token')
      .attach('file', oversizedFile, 'imagem.png')
      .expect(413);

    expect(uploadDisputeEvidenceMock).not.toHaveBeenCalled();
  });

  describe('GET /matches/:id/dispute-evidences/:evidenceId/image (E2E)', () => {
    const matchId = '550e8400-e29b-41d4-a716-446655440000';
    const evidenceId = '550e8400-e29b-41d4-a716-446655440002';
    const userId = 'authenticated-user-123';

    const imageUrl = `/matches/${matchId}/dispute-evidences/${evidenceId}/image`;

    const image = Buffer.from('imagem-privada-de-teste');

    beforeEach(() => {
      getDisputeEvidenceImageMock.mockResolvedValue(image);
    });

    it('deve rejeitar acesso sem JWT', async () => {
      await request(app.getHttpServer()).get(imageUrl).expect(401);

      expect(getDisputeEvidenceImageMock).not.toHaveBeenCalled();
    });

    it('deve permitir que um participante visualize a imagem', async () => {
      const response = await request(app.getHttpServer())
        .get(imageUrl)
        .set('Authorization', 'Bearer valid-test-token')
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];

          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
          res.on('error', callback);
        })
        .expect(200);

      expect(response.body).toEqual(image);
      expect(response.headers['content-type']).toMatch(/image\/png/);
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(response.headers['x-content-type-options']).toBe('nosniff');

      expect(getDisputeEvidenceImageMock).toHaveBeenCalledExactlyOnceWith(
        matchId,
        evidenceId,
        userId,
        false,
      );
    });

    it('deve identificar o administrador pelo JWT', async () => {
      findUniqueUserMock.mockResolvedValue({
        id: userId,
        username: 'test-admin',
        email: 'admin@example.test',
        role: UserRole.ADMIN,
      });

      await request(app.getHttpServer())
        .get(imageUrl)
        .set('Authorization', 'Bearer valid-test-token')
        .expect(200);

      expect(getDisputeEvidenceImageMock).toHaveBeenCalledExactlyOnceWith(
        matchId,
        evidenceId,
        userId,
        true,
      );
    });

    it('deve rejeitar acesso quando o serviço nega a permissão', async () => {
      const { ForbiddenException } = await import('@nestjs/common');

      getDisputeEvidenceImageMock.mockRejectedValue(
        new ForbiddenException('Acesso negado.'),
      );

      await request(app.getHttpServer())
        .get(imageUrl)
        .set('Authorization', 'Bearer valid-test-token')
        .expect(403);
    });

    it('deve rejeitar identificador de evidência inválido', async () => {
      await request(app.getHttpServer())
        .get(`/matches/${matchId}/dispute-evidences/invalid-id/image`)
        .set('Authorization', 'Bearer valid-test-token')
        .expect(400);

      expect(getDisputeEvidenceImageMock).not.toHaveBeenCalled();
    });
  });
});
