const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface MatchmakingPreferences {
  profileCountry: string | null;
  selectedCountries: string[];
  acceptedCountries: string[];
}

async function handleResponse(
  response: Response,
): Promise<MatchmakingPreferences> {
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Sua sessão expirou. Faça login novamente.");
    }

    if (response.status === 404) {
      throw new Error("Perfil de jogador não encontrado.");
    }

    if (response.status === 400) {
      throw new Error("Seleção de países inválida.");
    }

    if (response.status >= 500) {
      throw new Error("O servidor está indisponível. Tente novamente.");
    }

    throw new Error("Não foi possível concluir a operação.");
  }

  return (await response.json()) as MatchmakingPreferences;
}

export async function getMatchmakingPreferences(
  accessToken: string,
): Promise<MatchmakingPreferences> {
  const response = await fetch(`${API_URL}/matchmaking/preferences`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return handleResponse(response);
}

export async function updateMatchmakingPreferences(
  accessToken: string,
  countries: string[],
): Promise<MatchmakingPreferences> {
  const response = await fetch(`${API_URL}/matchmaking/preferences`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ countries }),
  });

  return handleResponse(response);
}
