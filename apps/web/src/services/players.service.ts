const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface PlayerProfile {
  id: string;
  gamertag: string | null;
  country: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePlayerProfileData {
  gamertag?: string;
  country?: string;
  avatarUrl?: string;
}

async function handleResponse(response: Response): Promise<PlayerProfile> {
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Sua sessão expirou. Faça login novamente.");
    }

    if (response.status === 409) {
      throw new Error("Esta gamertag já está cadastrada. Escolha outra.");
    }

    if (response.status === 400) {
      throw new Error(
        "Os dados informados são inválidos. Verifique os campos.",
      );
    }

    if (response.status >= 500) {
      throw new Error(
        "O servidor está indisponível. Tente novamente mais tarde.",
      );
    }

    throw new Error("Não foi possível concluir a operação. Tente novamente.");
  }

  return (await response.json()) as PlayerProfile;
}

export async function getMyProfile(
  accessToken: string,
): Promise<PlayerProfile> {
  const response = await fetch(`${API_URL}/players/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return handleResponse(response);
}

export async function updateMyProfile(
  accessToken: string,
  data: UpdatePlayerProfileData,
): Promise<PlayerProfile> {
  const response = await fetch(`${API_URL}/players/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(data),
  });

  return handleResponse(response);
}
