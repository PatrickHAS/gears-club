const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface LeaderboardPlayer {
  position: number;
  gamertag: string;
  country: string;
  avatarUrl: string | null;
  elo: number;
  wins: number;
  losses: number;
  matches: number;
  winRate: number;
}

export interface LeaderboardResponse {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  players: LeaderboardPlayer[];
}

export async function getLeaderboard(
  country?: string,
  page = 1,
): Promise<LeaderboardResponse> {
  const params = new URLSearchParams();

  if (country) {
    params.set("country", country);
  }

  params.set("page", String(page));

  const response = await fetch(
    `${API_URL}/ratings/leaderboard?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error("Não foi possível carregar o ranking de jogadores.");
  }

  return (await response.json()) as LeaderboardResponse;
}
