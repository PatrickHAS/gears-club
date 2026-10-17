const API_URL = import.meta.env.VITE_API_URL;

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: "USER" | "ADMIN";
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: AuthUser;
}

export interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export async function login(
  credentials: LoginCredentials,
): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("E-mail ou senha inválidos.");
    }

    throw new Error("Não foi possível realizar o login.");
  }

  return response.json() as Promise<LoginResponse>;
}

export async function register(
  credentials: RegisterCredentials,
): Promise<RegisterResponse> {
  const response = await fetch(`${API_URL}/users/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    if (response.status === 409) {
      throw new Error("Este e-mail ou nome de jogador já está cadastrado.");
    }

    if (response.status === 400) {
      throw new Error("Dados inválidos. Confira o nome, e-mail e senha.");
    }

    throw new Error("Não foi possível criar sua conta. Tente novamente.");
  }

  return response.json() as Promise<RegisterResponse>;
}

let pendingRefresh: Promise<LoginResponse> | null = null;

export function refreshSession(): Promise<LoginResponse> {
  if (pendingRefresh) {
    return pendingRefresh;
  }

  pendingRefresh = (async () => {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/auth/refresh`,
      {
        method: "POST",
        credentials: "include",
      },
    );

    if (!response.ok) {
      throw new Error("Sessão expirada ou inválida.");
    }

    return response.json() as Promise<LoginResponse>;
  })();

  void pendingRefresh
    .finally(() => {
      pendingRefresh = null;
    })
    .catch(() => {});

  return pendingRefresh;
}

export async function logoutSession(): Promise<void> {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Não foi possível encerrar a sessão.");
  }
}
