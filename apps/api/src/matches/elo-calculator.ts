
export type EloTeam = 'COG' | 'LOCUST';

export interface EloPlayer {
  playerProfileId: string;
  elo: number;
  team: EloTeam;
}

export interface EloChange {
  playerProfileId: string;
  previousElo: number;
  newElo: number;
  change: number;
}

const K_FACTOR = 32;

export function calculateEloChanges(
  players: EloPlayer[],
  winnerTeam: EloTeam,
): EloChange[] {
  if (players.length !== 8) {
    throw new Error('Uma partida deve possuir exatamente 8 jogadores.');
  }

  const cogPlayers = players.filter((player) => player.team === 'COG');
  const locustPlayers = players.filter((player) => player.team === 'LOCUST');

  if (cogPlayers.length !== 4 || locustPlayers.length !== 4) {
    throw new Error('Cada equipe deve possuir exatamente 4 jogadores.');
  }

  const average = (team: EloPlayer[]): number =>
    team.reduce((sum, player) => sum + player.elo, 0) / team.length;

  const cogAverage = average(cogPlayers);
  const locustAverage = average(locustPlayers);

  return players.map((player) => {
    const opponentAverage =
      player.team === 'COG' ? locustAverage : cogAverage;

    const ownAverage =
      player.team === 'COG' ? cogAverage : locustAverage;

    const expected =
      1 / (1 + Math.pow(10, (opponentAverage - ownAverage) / 400));

    const actual = player.team === winnerTeam ? 1 : 0;

    const change = Math.round(K_FACTOR * (actual - expected));

    return {
      playerProfileId: player.playerProfileId,
      previousElo: player.elo,
      newElo: Math.max(0, player.elo + change),
      change,
    };
  });
}
