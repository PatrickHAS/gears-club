import { useEffect, useState } from "react";

import {
  getMatchmakingPreferences,
  updateMatchmakingPreferences,
  type MatchmakingPreferences as Preferences,
} from "../services/matchmaking.service";

interface MatchmakingPreferencesProps {
  accessToken: string;
}

const countries = [
  { code: "BR", name: "Brasil", flag: "🇧🇷" },
  { code: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "CL", name: "Chile", flag: "🇨🇱" },
  { code: "UY", name: "Uruguai", flag: "🇺🇾" },
  { code: "CO", name: "Colômbia", flag: "🇨🇴" },
  { code: "EC", name: "Equador", flag: "🇪🇨" },
  { code: "PE", name: "Peru", flag: "🇵🇪" },
  { code: "BO", name: "Bolívia", flag: "🇧🇴" },
  { code: "PY", name: "Paraguai", flag: "🇵🇾" },
  { code: "VE", name: "Venezuela", flag: "🇻🇪" },
  { code: "MX", name: "México", flag: "🇲🇽" },
  { code: "US", name: "Estados Unidos", flag: "🇺🇸" },
  { code: "CA", name: "Canadá", flag: "🇨🇦" },
  { code: "GT", name: "Guatemala", flag: "🇬🇹" },
  { code: "HN", name: "Honduras", flag: "🇭🇳" },
  { code: "SV", name: "El Salvador", flag: "🇸🇻" },
  { code: "NI", name: "Nicarágua", flag: "🇳🇮" },
  { code: "CR", name: "Costa Rica", flag: "🇨🇷" },
  { code: "PA", name: "Panamá", flag: "🇵🇦" },
  { code: "DO", name: "República Dominicana", flag: "🇩🇴" },
  { code: "CU", name: "Cuba", flag: "🇨🇺" },
  { code: "HT", name: "Haiti", flag: "🇭🇹" },
];

export function MatchmakingPreferences({
  accessToken,
}: MatchmakingPreferencesProps) {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setSuccess(false);

      try {
        const data = await getMatchmakingPreferences(accessToken);

        if (!cancelled) {
          setPreferences(data);
          setSelected(
            data.selectedCountries.filter(
              (country) => country !== data.profileCountry,
            ),
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Não foi possível carregar as preferências.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  function toggleCountry(code: string) {
    setSuccess(false);

    setSelected((current) =>
      current.includes(code)
        ? current.filter((country) => country !== code)
        : [...current, code],
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updated = await updateMatchmakingPreferences(accessToken, selected);

      setPreferences(updated);
      setSelected(
        updated.selectedCountries.filter(
          (country) => country !== updated.profileCountry,
        ),
      );
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar as preferências.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="text-zinc-400">Carregando preferências de matchmaking...</p>
    );
  }

  if (!preferences) {
    return (
      <p className="text-red-400">
        {error ?? "Não foi possível carregar as preferências."}
      </p>
    );
  }

  return (
    <section className="mt-8 border-t border-zinc-800 pt-6">
      <h2 className="text-lg font-semibold text-red-500">
        Preferências de matchmaking
      </h2>

      <p className="mt-3 text-sm text-zinc-400">
        Escolha os países em cujas regiões você aceita jogar partidas
        competitivas. Seu país de perfil é aceito automaticamente.
      </p>

      <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <p className="text-sm text-zinc-400">País do perfil (automático)</p>

        <p className="mt-1 font-semibold text-white">
          {countries.find(
            (country) => country.code === preferences.profileCountry,
          )?.flag ?? "🌎"}{" "}
          {countries.find(
            (country) => country.code === preferences.profileCountry,
          )?.name ?? "Não definido"}
        </p>
      </div>

      <h3 className="mt-6 font-semibold text-white">
        Países adicionais aceitos
      </h3>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {countries
          .filter((country) => country.code !== preferences.profileCountry)
          .map((country) => (
            <label
              key={country.code}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3 transition hover:border-red-700"
            >
              <input
                type="checkbox"
                checked={selected.includes(country.code)}
                onChange={() => toggleCountry(country.code)}
                disabled={saving}
                className="h-4 w-4 accent-red-600"
              />

              <span className="text-sm text-white">
                {country.flag} {country.name}
              </span>
            </label>
          ))}
      </div>

      <div className="mt-6">
        <p className="text-sm text-zinc-400">
          Regiões aceitas:{" "}
          <span className="font-semibold text-white">
            {[
              ...new Set(
                [preferences.profileCountry, ...selected].filter(Boolean),
              ),
            ].join(", ") || "Nenhuma"}
          </span>
        </p>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-400">
            {error}
          </p>
        )}

        {success && (
          <p role="status" className="mt-3 text-sm text-green-400">
            Preferências salvas com sucesso!
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="mt-5 rounded-lg bg-red-700 px-6 py-3 font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar preferências"}
        </button>
      </div>
    </section>
  );
}
