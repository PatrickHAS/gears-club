import { useState, type FormEvent } from "react";
import { register } from "../services/auth.service";

interface RegisterProps {
  onBack: () => void;
  onSuccess: () => void;
}

export function Register({ onBack, onSuccess }: RegisterProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    if (password.length < 12) {
      setError("A senha deve ter pelo menos 12 caracteres.");
      return;
    }

    setLoading(true);

    try {
      await register({
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro inesperado ao criar a conta.",
      );
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none transition focus:border-red-600";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090909] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 text-sm text-zinc-400 hover:text-white"
        >
          ← Voltar ao início
        </button>

        <img
          src="/gears-club-logo.png"
          alt="Gears Club"
          className="mx-auto mb-5 h-28 w-28 object-contain"
        />

        <h1 className="text-center text-3xl font-bold text-white">
          ENTRE PARA A ARENA
        </h1>

        <p className="mt-2 text-center text-sm text-zinc-400">
          Crie sua conta e prepare-se para competir.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="username"
              className="mb-2 block text-sm text-zinc-300"
            >
              Nome de jogador
            </label>

            <input
              id="username"
              type="text"
              autoComplete="username"
              minLength={3}
              maxLength={20}
              pattern="[a-zA-Z0-9_]+"
              title="Use apenas letras, números e underscore."
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Ex: GearsWarrior"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="register-email"
              className="mb-2 block text-sm text-zinc-300"
            >
              E-mail
            </label>

            <input
              id="register-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu@email.com"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="register-password"
              className="mb-2 block text-sm text-zinc-300"
            >
              Senha
            </label>

            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mínimo de 12 caracteres"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="mb-2 block text-sm text-zinc-300"
            >
              Confirmar senha
            </label>

            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Digite a senha novamente"
              className={inputClass}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-red-700 px-4 py-3 font-bold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "CRIANDO CONTA..." : "CRIAR MINHA CONTA"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-500">
          Gears Club — A nova arena competitiva.
        </p>
      </div>
    </main>
  );
}
