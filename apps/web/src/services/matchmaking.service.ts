const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface MatchmakingPreferences {
  profileCountry: string | null;
  selectedCountries: string[];
  acceptedCountries: string[];
}

export interface MatchmakingQueueEntry {
  userId: string;
  joinedAt: string;
}

export interface MatchmakingQueueStatus {
  inQueue: boolean;
  entry: MatchmakingQueueEntry | null;
}

export interface MatchmakingQueueLeaveResult {
  removed: boolean;
}

export interface MatchmakingQueueHeartbeatResult {
  renewed: boolean;
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

async function handleQueueResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Sua sessão expirou. Faça login novamente.");
    }

    if (response.status === 400) {
      throw new Error(
        "Defina sua gamertag e seu país no perfil antes de buscar uma partida.",
      );
    }

    if (response.status === 404) {
      throw new Error("Você não está na fila de matchmaking.");
    }

    if (response.status === 409) {
      throw new Error("Você já está na fila de matchmaking.");
    }

    if (response.status >= 500) {
      throw new Error("O servidor está indisponível. Tente novamente.");
    }

    throw new Error("Não foi possível concluir a operação de matchmaking.");
  }

  return (await response.json()) as T;
}

export async function joinMatchmakingQueue(
  accessToken: string,
): Promise<MatchmakingQueueEntry> {
  const response = await fetch(`${API_URL}/matchmaking/queue`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return handleQueueResponse<MatchmakingQueueEntry>(response);
}

export async function getMatchmakingQueueStatus(
  accessToken: string,
): Promise<MatchmakingQueueStatus> {
  const response = await fetch(`${API_URL}/matchmaking/queue`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return handleQueueResponse<MatchmakingQueueStatus>(response);
}

export async function leaveMatchmakingQueue(
  accessToken: string,
): Promise<MatchmakingQueueLeaveResult> {
  const response = await fetch(`${API_URL}/matchmaking/queue`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return handleQueueResponse<MatchmakingQueueLeaveResult>(response);
}

export async function heartbeatMatchmakingQueue(
  accessToken: string,
): Promise<MatchmakingQueueHeartbeatResult> {
  const response = await fetch(`${API_URL}/matchmaking/queue/heartbeat`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return handleQueueResponse<MatchmakingQueueHeartbeatResult>(response);
}
