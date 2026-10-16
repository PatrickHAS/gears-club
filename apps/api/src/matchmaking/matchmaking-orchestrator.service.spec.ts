import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MatchmakingOrchestratorService } from './matchmaking-orchestrator.service.js';
import { MatchmakingQueueService } from './matchmaking-queue/matchmaking-queue.service.js';
import { MatchesService } from '../matches/matches.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('MatchmakingOrchestratorService', () => {
  const userIds = Array.from({ length: 8 }, (_, index) => `user-${index + 1}`);

  const selection = {
    region: 'BR',
    eloDifference: 100,
    players: userIds.map((userId, index) => ({
      userId,
      joinedAt: new Date(2026, 0, 1).toISOString(),
      gamertag: `Player${index + 1}`,
      country: 'BR',
      elo: 1000 + index * 10,
      acceptedCountries: ['BR'],
    })),
  };

  const profiles = userIds.map((userId, index) => ({
    id: `profile-${index + 1}`,
    userId,
  }));

  const match = {
    id: 'match-123',
    region: 'BR',
    status: 'PENDING',
    participants: profiles.map((profile, index) => ({
      playerProfileId: profile.id,
      team: index < 4 ? 'COG' : 'LOCUST',
    })),
  };

  const queue = {
    findMatch: vi.fn(),
    reservePlayers: vi.fn(),
    releaseReservation: vi.fn(),
  };

  const matches = {
    createMatch: vi.fn(),
  };

  const prisma = {
    playerProfile: {
      findMany: vi.fn(),
    },
    match: {
      findUnique: vi.fn(),
    },
  };

  let service: MatchmakingOrchestratorService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.match.findUnique.mockReset();
    prisma.match.findUnique.mockResolvedValue(null);

    service = new MatchmakingOrchestratorService(
      queue as unknown as MatchmakingQueueService,
      matches as unknown as MatchesService,
      prisma as unknown as PrismaService,
    );
  });

  it('retorna null quando não há jogadores compatíveis', async () => {
    queue.findMatch.mockResolvedValue(null);

    const result = await service.createMatchFromQueue();

    expect(result).toBeNull();
    expect(queue.reservePlayers).not.toHaveBeenCalled();
    expect(matches.createMatch).not.toHaveBeenCalled();
  });

  it('não cria partida quando a reserva é recusada', async () => {
    queue.findMatch.mockResolvedValue(selection);
    queue.reservePlayers.mockResolvedValue(false);

    const result = await service.createMatchFromQueue();

    expect(result).toBeNull();
    expect(prisma.playerProfile.findMany).not.toHaveBeenCalled();
    expect(matches.createMatch).not.toHaveBeenCalled();
  });

  it('cria uma partida 4v4 após reservar os jogadores', async () => {
    queue.findMatch.mockResolvedValue(selection);
    queue.reservePlayers.mockResolvedValue(true);
    prisma.playerProfile.findMany.mockResolvedValue([...profiles].reverse());
    matches.createMatch.mockResolvedValue(match);

    const result = await service.createMatchFromQueue();

    expect(result).toEqual(match);

    expect(queue.reservePlayers).toHaveBeenCalledWith(
      userIds,
      expect.any(String),
    );

    expect(matches.createMatch).toHaveBeenCalledWith({
      playerProfileIds: profiles.map((profile) => profile.id),
      region: 'BR',
      reservationId: expect.any(String),
    });

    expect(queue.releaseReservation).not.toHaveBeenCalled();
  });

  it('libera a reserva quando algum perfil não existe', async () => {
    queue.findMatch.mockResolvedValue(selection);
    queue.reservePlayers.mockResolvedValue(true);
    prisma.playerProfile.findMany.mockResolvedValue(profiles.slice(0, 7));

    await expect(service.createMatchFromQueue()).rejects.toThrow(
      'Não foi possível encontrar os oito perfis.',
    );

    expect(matches.createMatch).not.toHaveBeenCalled();

    const reservationId = queue.reservePlayers.mock.calls[0][1];

    expect(queue.releaseReservation).toHaveBeenCalledWith(
      userIds,
      reservationId,
    );
  });

  it('preserva a reserva quando a criação da partida falha', async () => {
    queue.findMatch.mockResolvedValue(selection);
    queue.reservePlayers.mockResolvedValue(true);
    prisma.playerProfile.findMany.mockResolvedValue(profiles);

    matches.createMatch.mockRejectedValue(new Error('PostgreSQL indisponível'));

    await expect(service.createMatchFromQueue()).rejects.toThrow(
      'PostgreSQL indisponível',
    );

    const reservationId = queue.reservePlayers.mock.calls[0][1];

    expect(prisma.match.findUnique).toHaveBeenCalledWith({
      where: { reservationId },
      include: { participants: true },
    });

    expect(queue.releaseReservation).not.toHaveBeenCalled();
  });

  it('preserva o erro original quando a liberação pré-criação falha', async () => {
    queue.findMatch.mockResolvedValue(selection);
    queue.reservePlayers.mockResolvedValue(true);

    prisma.playerProfile.findMany.mockRejectedValue(
      new Error('Falha ao buscar perfis'),
    );

    queue.releaseReservation.mockRejectedValue(new Error('Redis indisponível'));

    await expect(service.createMatchFromQueue()).rejects.toThrow(
      'Falha ao buscar perfis',
    );

    expect(matches.createMatch).not.toHaveBeenCalled();
    expect(queue.releaseReservation).toHaveBeenCalledOnce();
    expect(prisma.match.findUnique).not.toHaveBeenCalled();
  });

  it('recupera partida criada quando a resposta do PostgreSQL falha', async () => {
    queue.findMatch.mockResolvedValue(selection);
    queue.reservePlayers.mockResolvedValue(true);
    prisma.playerProfile.findMany
      .mockResolvedValueOnce(profiles)
      .mockResolvedValueOnce(profiles);

    matches.createMatch.mockRejectedValue(
      new Error('Conexão perdida após criar partida'),
    );

    prisma.match.findUnique.mockResolvedValue(match);

    const result = await service.createMatchFromQueue();

    expect(result).toEqual(match);

    const reservationId = queue.reservePlayers.mock.calls[0][1];

    expect(prisma.match.findUnique).toHaveBeenCalledWith({
      where: { reservationId },
      include: { participants: true },
    });

    expect(queue.releaseReservation).not.toHaveBeenCalled();
  });

  it('preserva a reserva quando não consegue consultar o PostgreSQL', async () => {
    queue.findMatch.mockResolvedValue(selection);
    queue.reservePlayers.mockResolvedValue(true);
    prisma.playerProfile.findMany.mockResolvedValue(profiles);

    matches.createMatch.mockRejectedValue(new Error('Falha ao criar partida'));

    prisma.match.findUnique.mockRejectedValue(
      new Error('PostgreSQL indisponível'),
    );

    await expect(service.createMatchFromQueue()).rejects.toThrow(
      'Falha ao criar partida',
    );

    expect(queue.releaseReservation).not.toHaveBeenCalled();
  });

  it('rejeita partida recuperada de outra região sem liberar a reserva', async () => {
    queue.findMatch.mockResolvedValue(selection);
    queue.reservePlayers.mockResolvedValue(true);
    prisma.playerProfile.findMany.mockResolvedValue(profiles);

    matches.createMatch.mockRejectedValue(
      new Error('Conexão perdida após criar partida'),
    );

    prisma.match.findUnique.mockResolvedValue({
      ...match,
      region: 'US',
    });

    await expect(service.createMatchFromQueue()).rejects.toThrow(
      'A partida recuperada não corresponde à reserva original.',
    );

    expect(queue.releaseReservation).not.toHaveBeenCalled();
  });

  it('rejeita partida recuperada com jogadores diferentes', async () => {
    queue.findMatch.mockResolvedValue(selection);
    queue.reservePlayers.mockResolvedValue(true);

    prisma.playerProfile.findMany
      .mockResolvedValueOnce(profiles)
      .mockResolvedValueOnce([
        ...profiles.slice(0, 7),
        { id: 'profile-99', userId: 'user-99' },
      ]);

    matches.createMatch.mockRejectedValue(
      new Error('Conexão perdida após criar partida'),
    );

    prisma.match.findUnique.mockResolvedValue({
      ...match,
      participants: [
        ...match.participants.slice(0, 7),
        {
          playerProfileId: 'profile-99',
          team: 'LOCUST',
        },
      ],
    });

    await expect(service.createMatchFromQueue()).rejects.toThrow(
      'A partida recuperada não corresponde à reserva original.',
    );

    expect(queue.releaseReservation).not.toHaveBeenCalled();
  });

  it('preserva a reserva quando a validação dos participantes falha', async () => {
    queue.findMatch.mockResolvedValue(selection);
    queue.reservePlayers.mockResolvedValue(true);

    prisma.playerProfile.findMany
      .mockResolvedValueOnce(profiles)
      .mockRejectedValueOnce(new Error('Falha ao consultar participantes'));

    matches.createMatch.mockRejectedValue(
      new Error('Conexão perdida após criar partida'),
    );

    prisma.match.findUnique.mockResolvedValue(match);

    await expect(service.createMatchFromQueue()).rejects.toThrow(
      'Falha ao consultar participantes',
    );

    expect(prisma.match.findUnique).toHaveBeenCalledOnce();
    expect(prisma.playerProfile.findMany).toHaveBeenCalledTimes(2);
    expect(queue.releaseReservation).not.toHaveBeenCalled();
  });
});
