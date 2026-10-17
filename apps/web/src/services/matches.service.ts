const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface PendingDispute {
  id: string;
  mode: "DEMOLITION";
  region: string;
  status: "DISPUTED";
  createdAt: string;
  startedAt: string | null;
  updatedAt: string;
  participantsCount: number;
  reportsCount: number;
  evidencesCount: number;
}

export type MatchTeam = "COG" | "LOCUST";

export interface DisputeParticipant {
  playerProfileId: string;
  gamertag: string | null;
  country: string | null;
  team: MatchTeam;
  isCaptain: boolean;
}

export interface DisputeResultReport {
  id: string;
  captainId: string;
  winnerTeam: MatchTeam;
  createdAt: string;
}

export interface DisputeEvidence {
  id: string;
  captainId: string;
  createdAt: string;
}

export interface DisputeReview {
  id: string;
  mode: "DEMOLITION";
  region: string;
  status: "DISPUTED";
  createdAt: string;
  startedAt: string | null;
  participants: DisputeParticipant[];
  resultReports: DisputeResultReport[];
  disputeEvidences: DisputeEvidence[];
}

export async function getPendingDisputes(
  accessToken: string,
): Promise<PendingDispute[]> {
  const response = await fetch(`${API_URL}/matches/admin/disputes`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Sua sessão expirou. Faça login novamente.");
    }

    if (response.status === 403) {
      throw new Error("Você não possui permissão para acessar as disputas.");
    }

    if (response.status >= 500) {
      throw new Error("O servidor está indisponível. Tente novamente.");
    }

    throw new Error("Não foi possível carregar as disputas pendentes.");
  }

  return (await response.json()) as PendingDispute[];
}

export async function getDisputeReview(
  accessToken: string,
  matchId: string,
): Promise<DisputeReview> {
  const response = await fetch(
    `${API_URL}/matches/${encodeURIComponent(matchId)}/dispute-review`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Sua sessão expirou. Faça login novamente.");
    }

    if (response.status === 403) {
      throw new Error("Você não possui permissão para analisar esta disputa.");
    }

    if (response.status === 404) {
      throw new Error("Partida não encontrada.");
    }

    if (response.status === 409) {
      throw new Error("Esta partida não possui mais uma disputa pendente.");
    }

    if (response.status >= 500) {
      throw new Error("O servidor está indisponível. Tente novamente.");
    }

    throw new Error("Não foi possível carregar os detalhes da disputa.");
  }

  return (await response.json()) as DisputeReview;
}

export async function getDisputeEvidenceImage(
  accessToken: string,
  matchId: string,
  evidenceId: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await fetch(
    `${API_URL}/matches/${encodeURIComponent(matchId)}/dispute-evidences/${encodeURIComponent(evidenceId)}/image`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal,
    },
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Sua sessão expirou. Faça login novamente.");
    }

    if (response.status === 403) {
      throw new Error("Você não possui permissão para visualizar esta imagem.");
    }

    if (response.status === 404) {
      throw new Error("Evidência não encontrada.");
    }

    if (response.status >= 500) {
      throw new Error("O servidor está indisponível. Tente novamente.");
    }

    throw new Error("Não foi possível carregar a evidência.");
  }

  const contentType = response.headers.get("Content-Type") ?? "";

  if (!contentType.toLowerCase().startsWith("image/png")) {
    throw new Error("O servidor retornou um formato de imagem inesperado.");
  }

  return response.blob();
}

export interface ResolveDisputePayload {
  winnerTeam: MatchTeam;
  reason: string;
  evidenceIds: string[];
  gamertagsVerified: true;
}

export async function resolveDispute(
  accessToken: string,
  matchId: string,
  payload: ResolveDisputePayload,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/matches/${encodeURIComponent(matchId)}/resolve-dispute`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    if (response.status === 400) {
      throw new Error(
        "Dados inválidos. Confira a justificativa, as evidências e as gamertags.",
      );
    }

    if (response.status === 401) {
      throw new Error("Sua sessão expirou. Faça login novamente.");
    }

    if (response.status === 403) {
      throw new Error("Você não possui permissão para resolver disputas.");
    }

    if (response.status === 404) {
      throw new Error("Partida não encontrada.");
    }

    if (response.status === 409) {
      throw new Error(
        "Esta disputa já foi resolvida ou não pode mais ser homologada. Atualize a lista.",
      );
    }

    if (response.status >= 500) {
      throw new Error(
        "Erro interno ao resolver a disputa. Atualize a lista antes de tentar novamente.",
      );
    }

    throw new Error("Não foi possível resolver a disputa.");
  }
}
