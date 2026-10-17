
import { describe, expect, it } from 'vitest';
import {
  calculateEloChanges,
  type EloPlayer,
} from './elo-calculator.js';

describe('calculateEloChanges', () => {
  const createPlayers = (
    cogElo = 1000,
    locustElo = 1000,
  ): EloPlayer[] => [
    ...Array.from({ length: 4 }, (_, index) => ({
      playerProfileId: `cog-${index}`,
      elo: cogElo,
      team: 'COG' as const,
    })),
    ...Array.from({ length: 4 }, (_, index) => ({
      playerProfileId: `locust-${index}`,
      elo: locustElo,
      team: 'LOCUST' as const,
    })),
  ];

  it('deve dar 16 pontos aos vencedores com equipes equilibradas', () => {
    const result = calculateEloChanges(createPlayers(), 'COG');

    expect(result).toHaveLength(8);

    for (const player of result) {
      if (player.playerProfileId.startsWith('cog-')) {
        expect(player.newElo).toBe(1016);
        expect(player.change).toBe(16);
      } else {
        expect(player.newElo).toBe(984);
        expect(player.change).toBe(-16);
      }
    }
  });

  it('deve recompensar mais uma equipe mais fraca que vence', () => {
    const result = calculateEloChanges(
      createPlayers(800, 1200),
      'COG',
    );

    const winners = result.filter((player) =>
      player.playerProfileId.startsWith('cog-'),
    );

    expect(winners).toHaveLength(4);
    expect(winners.every((player) => player.change > 16)).toBe(true);
  });

  it('deve recompensar menos uma equipe favorita que vence', () => {
    const result = calculateEloChanges(
      createPlayers(1200, 800),
      'COG',
    );

    const winners = result.filter((player) =>
      player.playerProfileId.startsWith('cog-'),
    );

    expect(winners).toHaveLength(4);
    expect(winners.every((player) => player.change < 16)).toBe(true);
  });

  it('deve impedir ELO negativo', () => {
    const result = calculateEloChanges(
      createPlayers(0, 1000),
      'LOCUST',
    );

    const losers = result.filter((player) =>
      player.playerProfileId.startsWith('cog-'),
    );

    expect(losers.every((player) => player.newElo >= 0)).toBe(true);
  });

  it('deve rejeitar partidas com menos de oito jogadores', () => {
    const players = createPlayers().slice(0, 7);

    expect(() => calculateEloChanges(players, 'COG')).toThrow(
      'Uma partida deve possuir exatamente 8 jogadores.',
    );
  });

  it('deve rejeitar equipes que não sejam 4v4', () => {
    const players = createPlayers();

    players[0].team = 'LOCUST';

    expect(() => calculateEloChanges(players, 'COG')).toThrow(
      'Cada equipe deve possuir exatamente 4 jogadores.',
    );
  });
});
