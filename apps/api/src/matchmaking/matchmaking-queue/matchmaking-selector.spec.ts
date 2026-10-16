import { describe, expect, it } from 'vitest';

import type { MatchmakingCandidate } from './matchmaking-queue.service.js';
import { selectMatchmakingPlayers } from './matchmaking-selector.js';

function createPlayer(
  id: number,
  elo = 1000,
  acceptedCountries: string[] = ['BR'],
): MatchmakingCandidate {
  return {
    userId: `user-${id}`,
    gamertag: `Player${id}`,
    country: 'BR',
    elo,
    acceptedCountries,
    joinedAt: new Date(Date.UTC(2026, 9, 16, 18, id)).toISOString(),
  };
}

describe('MatchmakingSelector', () => {
  it('não deve formar partida com menos de 8 jogadores', () => {
    const players = Array.from({ length: 7 }, (_, i) => createPlayer(i));

    expect(selectMatchmakingPlayers(players)).toBeNull();
  });

  it('deve formar uma partida com 8 jogadores compatíveis', () => {
    const players = Array.from({ length: 8 }, (_, i) =>
      createPlayer(i, 1000 + i * 10),
    );

    const result = selectMatchmakingPlayers(players, () => 0);

    expect(result).not.toBeNull();
    expect(result?.players).toHaveLength(8);
    expect(result?.region).toBe('BR');
    expect(result?.eloDifference).toBe(70);
  });

  it('não deve formar partida com diferença de ELO acima de 200', () => {
    const players = [
      ...Array.from({ length: 7 }, (_, i) => createPlayer(i, 1000)),
      createPlayer(7, 1300),
    ];

    expect(selectMatchmakingPlayers(players)).toBeNull();
  });

  it('deve exigir uma região aceita pelos 8 jogadores', () => {
    const players = [
      ...Array.from({ length: 7 }, (_, i) => createPlayer(i, 1000, ['BR'])),
      createPlayer(7, 1000, ['US']),
    ];

    expect(selectMatchmakingPlayers(players)).toBeNull();
  });

  it('deve permitir brasileiros e americanos na região US', () => {
    const players = [
      ...Array.from({ length: 4 }, (_, i) =>
        createPlayer(i, 1000, ['BR', 'US']),
      ),
      ...Array.from({ length: 4 }, (_, i) => createPlayer(i + 4, 1050, ['US'])),
    ];

    const result = selectMatchmakingPlayers(players, () => 0);

    expect(result?.players).toHaveLength(8);
    expect(result?.region).toBe('US');
  });

  it('deve sortear entre regiões comuns', () => {
    const players = Array.from({ length: 8 }, (_, i) =>
      createPlayer(i, 1000, ['BR', 'MX', 'US']),
    );

    expect(selectMatchmakingPlayers(players, () => 0)?.region).toBe('BR');

    expect(selectMatchmakingPlayers(players, () => 0.5)?.region).toBe('MX');

    expect(selectMatchmakingPlayers(players, () => 0.99)?.region).toBe('US');
  });

  it('deve priorizar a ordem de entrada na fila', () => {
    const players = Array.from({ length: 9 }, (_, i) =>
      createPlayer(i),
    ).reverse();

    const result = selectMatchmakingPlayers(players, () => 0);

    expect(result?.players.map((player) => player.userId)).toEqual(
      Array.from({ length: 8 }, (_, i) => `user-${i}`),
    );
  });

  it('deve encontrar um grupo compatível mesmo com jogador incompatível na fila', () => {
    const players = [
      createPlayer(0, 2000, ['BR']),
      ...Array.from({ length: 8 }, (_, i) => createPlayer(i + 1, 1000, ['US'])),
    ];

    const result = selectMatchmakingPlayers(players, () => 0);

    expect(result?.players).toHaveLength(8);
    expect(result?.region).toBe('US');
    expect(result?.players.some((player) => player.userId === 'user-0')).toBe(
      false,
    );
  });
});
