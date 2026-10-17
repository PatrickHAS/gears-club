import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { MatchesController } from './matches.controller.js';
import { MatchesService } from './matches.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

describe('MatchesController', () => {
  let controller: MatchesController;

  const getMatchByIdMock = vi.fn();
  const startMatchMock = vi.fn();

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
});
