import { useState, type FormEvent } from "react";
import { login } from "../services/auth.service";
import { useAuth } from "../contexts/AuthContext";

interface LoginProps {
  onSuccess: () => void;
  onBack: () => void;
}

export function Login({ onSuccess, onBack }: LoginProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await login({ email, password });
      signIn(result);
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro inesperado ao realizar login.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090909] px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl">
        <button
          type="button"
          onClick={onBack}
          className="mb-8 text-sm text-zinc-400 hover:text-white"
        >
          ← Voltar ao início
        </button>

        <img
          src="/gears-club-logo.png"
          alt="Gears Club"
          className="mx-auto mb-6 h-32 w-32 object-contain"
        />

        <h1 className="text-center text-3xl font-bold text-white">
          ENTRAR NA ARENA
        </h1>

        <p className="mt-2 text-center text-sm text-zinc-400">
          Acesse sua conta Gears Club
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm text-zinc-300">
              E-mail
            </label>

            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu@email.com"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-red-600"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm text-zinc-300"
            >
              Senha
            </label>

            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Digite sua senha"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-red-600"
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
            {loading ? "ENTRANDO..." : "ENTRAR"}
          </button>
        </form>
      </div>
    </main>
  );
}
