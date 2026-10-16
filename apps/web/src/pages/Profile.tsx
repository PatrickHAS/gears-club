import { useEffect, useState } from "react";

import { useAuth } from "../contexts/AuthContext";
import { EditPlayerProfile } from "../components/EditPlayerProfile";
import { MatchmakingPreferences } from "../components/MatchmakingPreferences";

import {
  getMyProfile,
  updateMyProfile,
  type PlayerProfile,
  type UpdatePlayerProfileData,
} from "../services/players.service";

interface ProfileProps {
  onBack: () => void;
}

const countryNames: Record<string, string> = {
  BR: "🇧🇷 Brasil",
  AR: "🇦🇷 Argentina",
  CL: "🇨🇱 Chile",
  UY: "🇺🇾 Uruguai",
  CO: "🇨🇴 Colômbia",
  EC: "🇪🇨 Equador",
  PE: "🇵🇪 Peru",
  BO: "🇧🇴 Bolívia",
  PY: "🇵🇾 Paraguai",
  VE: "🇻🇪 Venezuela",
  MX: "🇲🇽 México",
  US: "🇺🇸 Estados Unidos",
  CA: "🇨🇦 Canadá",
  GT: "🇬🇹 Guatemala",
  HN: "🇭🇳 Honduras",
  SV: "🇸🇻 El Salvador",
  NI: "🇳🇮 Nicarágua",
  CR: "🇨🇷 Costa Rica",
  PA: "🇵🇦 Panamá",
  DO: "🇩🇴 República Dominicana",
  CU: "🇨🇺 Cuba",
  HT: "🇭🇹 Haiti",
};

export function Profile({ onBack }: ProfileProps) {
  const { accessToken, isAuthenticated } = useAuth();

  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!accessToken) {
        setProfile(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setProfile(null);
      setIsEditing(false);

      try {
        const data = await getMyProfile(accessToken);

        if (!cancelled) {
          setProfile(data);
        }
      } catch {
        if (!cancelled) {
          setError("Não foi possível carregar o perfil.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function handleSave(data: UpdatePlayerProfileData) {
    if (!accessToken) {
      throw new Error("Sua sessão expirou. Faça login novamente.");
    }

    const updatedProfile = await updateMyProfile(accessToken, data);

    setProfile(updatedProfile);
    setIsEditing(false);
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-black px-6 py-20 text-center text-white">
        <h1 className="text-2xl font-bold">Acesso restrito</h1>
        <p className="mt-3 text-zinc-400">
          Faça login para acessar seu perfil.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-6 rounded-lg bg-red-700 px-6 py-3 font-semibold"
        >
          Voltar
        </button>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-black py-20 text-center text-red-500">
        Carregando perfil...
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="min-h-screen bg-black px-6 py-20 text-center text-white">
        <p>{error ?? "Perfil não encontrado."}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-6 rounded-lg bg-red-700 px-6 py-3"
        >
          Voltar
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto max-w-4xl">
        <button
          type="button"
          onClick={onBack}
          className="mb-8 text-zinc-400 transition hover:text-white"
        >
          ← Voltar
        </button>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-800">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt="Avatar do jogador"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-3xl">🎮</span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="break-words text-2xl font-bold">
                {profile.gamertag ?? "Defina sua gamertag"}
              </h1>

              <p className="mt-2 text-zinc-400">
                {profile.country
                  ? (countryNames[profile.country] ?? profile.country)
                  : "País não informado"}
              </p>
            </div>

            {!isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="rounded-lg bg-red-700 px-5 py-3 font-semibold text-white transition hover:bg-red-600"
              >
                Editar perfil
              </button>
            )}
          </div>

          {isEditing && (
            <EditPlayerProfile
              profile={profile}
              onSave={handleSave}
              onCancel={() => setIsEditing(false)}
            />
          )}

          <div className="mt-8 border-t border-zinc-800 pt-6">
            <h2 className="text-lg font-semibold text-red-500">
              Estatísticas competitivas
            </h2>

            <p className="mt-3 text-zinc-400">
              ELO, vitórias, derrotas e VT estarão disponíveis após a
              implementação do sistema de partidas.
            </p>
          </div>
          {accessToken && <MatchmakingPreferences accessToken={accessToken} />}
        </div>
      </div>
    </main>
  );
}
