import type { MatchmakingCandidate } from './matchmaking-queue.service.js';

export interface MatchmakingSelection {
  players: MatchmakingCandidate[];
  region: string;
  eloDifference: number;
}

const PLAYERS_PER_MATCH = 8;
const MAX_ELO_DIFFERENCE = 200;

export function selectMatchmakingPlayers(
  candidates: MatchmakingCandidate[],
  random: () => number = Math.random,
): MatchmakingSelection | null {
  if (candidates.length < PLAYERS_PER_MATCH) {
    return null;
  }

  const ordered = [...candidates].sort(
    (a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime(),
  );

  for (const anchor of ordered) {
    const compatible = ordered.filter((candidate) => {
      return (
        Math.abs(candidate.elo - anchor.elo) <= MAX_ELO_DIFFERENCE &&
        candidate.acceptedCountries.some((country) =>
          anchor.acceptedCountries.includes(country),
        )
      );
    });

    if (compatible.length < PLAYERS_PER_MATCH) {
      continue;
    }

    const combinations = findCompatibleGroup(compatible, PLAYERS_PER_MATCH);

    if (!combinations) {
      continue;
    }

    const regions = getCommonRegions(combinations);

    const randomValue = random();

    if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
      throw new RangeError(
        'O gerador aleatório deve retornar um número entre 0 e 1 (exclusivo).',
      );
    }

    const region = regions[Math.floor(randomValue * regions.length)];

    const elos = combinations.map((player) => player.elo);

    return {
      players: combinations,
      region,
      eloDifference: Math.max(...elos) - Math.min(...elos),
    };
  }

  return null;
}

function getCommonRegions(players: MatchmakingCandidate[]): string[] {
  if (players.length === 0) {
    return [];
  }

  return [...new Set(players[0].acceptedCountries)]
    .filter((country) =>
      players.every((player) => player.acceptedCountries.includes(country)),
    )
    .sort();
}

function findCompatibleGroup(
  candidates: MatchmakingCandidate[],
  size: number,
): MatchmakingCandidate[] | null {
  function search(
    start: number,
    selected: MatchmakingCandidate[],
    commonRegions: string[] | null,
    minElo: number,
    maxElo: number,
  ): MatchmakingCandidate[] | null {
    if (selected.length === size) {
      return selected;
    }

    if (candidates.length - start < size - selected.length) {
      return null;
    }

    for (let i = start; i < candidates.length; i++) {
      const candidate = candidates[i];

      const nextMinElo = Math.min(minElo, candidate.elo);
      const nextMaxElo = Math.max(maxElo, candidate.elo);

      if (nextMaxElo - nextMinElo > MAX_ELO_DIFFERENCE) {
        continue;
      }

      const nextRegions =
        commonRegions === null
          ? [...new Set(candidate.acceptedCountries)]
          : commonRegions.filter((country) =>
              candidate.acceptedCountries.includes(country),
            );

      if (nextRegions.length === 0) {
        continue;
      }

      const result = search(
        i + 1,
        [...selected, candidate],
        nextRegions,
        nextMinElo,
        nextMaxElo,
      );

      if (result) {
        return result;
      }
    }

    return null;
  }

  return search(0, [], null, Infinity, -Infinity);
}
