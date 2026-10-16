import { useState, type FormEvent } from "react";

import type {
  PlayerProfile,
  UpdatePlayerProfileData,
} from "../services/players.service";

interface EditPlayerProfileProps {
  profile: PlayerProfile;
  onSave: (data: UpdatePlayerProfileData) => Promise<void>;
  onCancel: () => void;
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

export function EditPlayerProfile({
  profile,
  onSave,
  onCancel,
}: EditPlayerProfileProps) {
  const [gamertag, setGamertag] = useState(profile.gamertag ?? "");

  const [country, setCountry] = useState(profile.country ?? "");

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedGamertag = gamertag.trim();

    if (trimmedGamertag.length < 3 || trimmedGamertag.length > 32) {
      setError("A gamertag deve ter entre 3 e 32 caracteres.");
      return;
    }

    if (!country) {
      setError("Selecione um país.");
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      await onSave({
        gamertag: trimmedGamertag,
        country,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar o perfil.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="mt-8 space-y-6 border-t border-zinc-800 pt-6"
    >
      <h2 className="text-xl font-bold text-white">Editar perfil</h2>

      <div>
        <label
          htmlFor="gamertag"
          className="mb-2 block text-sm font-semibold text-zinc-300"
        >
          Gamertag
        </label>

        <input
          id="gamertag"
          type="text"
          value={gamertag}
          onChange={(event) => setGamertag(event.target.value)}
          minLength={3}
          maxLength={32}
          required
          placeholder="Sua gamertag no Xbox"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-red-600"
        />
      </div>

      <div>
        <label
          htmlFor="country"
          className="mb-2 block text-sm font-semibold text-zinc-300"
        >
          País
        </label>

        <select
          id="country"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          required
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-red-600"
        >
          <option value="">Selecione seu país</option>

          {countries.map((item) => (
            <option key={item.code} value={item.code}>
              {item.flag} {item.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-red-700 px-6 py-3 font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
        >
          {isSaving ? "Salvando..." : "Salvar alterações"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-lg border border-zinc-700 px-6 py-3 font-semibold text-zinc-300 transition hover:text-white disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
