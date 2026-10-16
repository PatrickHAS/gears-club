import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../contexts/AuthContext";
import {
  getMatchmakingQueueStatus,
  heartbeatMatchmakingQueue,
  joinMatchmakingQueue,
  leaveMatchmakingQueue,
  type MatchmakingQueueEntry,
} from "../../services/matchmaking.service";

export function MatchmakingQueue() {
  const [isCheckingQueue, setIsCheckingQueue] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);
  const { isAuthenticated, accessToken } = useAuth();
  const navigate = useNavigate();

  const [queueEntry, setQueueEntry] = useState<MatchmakingQueueEntry | null>(
    null,
  );

  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function restoreQueue() {
      if (!accessToken) {
        setQueueEntry(null);
        setIsCheckingQueue(false);
        return;
      }

      setIsCheckingQueue(true);

      try {
        const status = await getMatchmakingQueueStatus(accessToken);

        if (!cancelled) {
          setQueueEntry(status.entry);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Não foi possível consultar a fila.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsCheckingQueue(false);
        }
      }
    }

    void restoreQueue();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !queueEntry) {
      return;
    }

    let cancelled = false;

    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          await heartbeatMatchmakingQueue(accessToken);
        } catch (err) {
          if (cancelled) {
            return;
          }

          // Se a inscrição expirou, o jogador não está mais na fila.
          if (
            err instanceof Error &&
            err.message === "Você não está na fila de matchmaking."
          ) {
            setQueueEntry(null);
          }

          setError(
            err instanceof Error
              ? err.message
              : "Não foi possível renovar a busca.",
          );
        }
      })();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [accessToken, queueEntry]);

  async function handleJoinQueue() {
    if (!isAuthenticated || !accessToken) {
      navigate("/login");
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const entry = await joinMatchmakingQueue(accessToken);
      setQueueEntry(entry);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível iniciar a busca.",
      );
    } finally {
      setIsJoining(false);
    }
  }

  async function handleLeaveQueue() {
    if (!accessToken || isLeaving) {
      return;
    }

    setIsLeaving(true);
    setError(null);

    try {
      await leaveMatchmakingQueue(accessToken);

      setQueueEntry(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível cancelar a busca.",
      );
    } finally {
      setIsLeaving(false);
    }
  }

  return (
    <div className="mx-auto mt-10 w-full max-w-2xl rounded-2xl border border-zinc-800 bg-[#18181d] p-6 text-left shadow-xl md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-500">
            Gears Club Ranked
          </p>

          <h3 className="mt-2 text-2xl font-black text-white">DEMOLIÇÃO 4V4</h3>
        </div>

        <span className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-bold uppercase tracking-wide text-zinc-300">
          Em breve
        </span>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Modo</p>
          <p className="mt-2 font-bold text-white">Ranqueado</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            Formato
          </p>
          <p className="mt-2 font-bold text-white">4 contra 4</p>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-950 p-5">
        <p className="text-sm font-medium text-zinc-400">Status da busca</p>

        <div className="mt-3 flex items-center gap-3">
          <span
            className={`h-3 w-3 rounded-full ${
              queueEntry ? "animate-pulse bg-green-500" : "bg-zinc-500"
            }`}
          />

          <span className="font-bold text-white">
            {queueEntry ? "Buscando partida..." : "Fora da fila"}
          </span>
        </div>
      </div>

      {queueEntry ? (
        <button
          type="button"
          onClick={() => void handleLeaveQueue()}
          disabled={isLeaving}
          className="mt-6 w-full rounded-xl border border-red-600 bg-red-600/10 px-6 py-4 text-base font-black uppercase tracking-wider text-red-500 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLeaving ? "Cancelando busca..." : "Cancelar busca"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void handleJoinQueue()}
          disabled={isCheckingQueue || isJoining}
          className="mt-6 w-full rounded-xl bg-red-700 px-6 py-4 text-base font-black uppercase tracking-wider text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCheckingQueue
            ? "Verificando fila..."
            : isJoining
              ? "Entrando na fila..."
              : isAuthenticated
                ? "Buscar partida"
                : "Entre para jogar"}
        </button>
      )}

      {error && (
        <p role="alert" className="mt-4 text-center text-sm text-red-400">
          {error}
        </p>
      )}

      <p className="mt-4 text-center text-xs text-zinc-500">
        O matchmaking está em desenvolvimento.
      </p>
    </div>
  );
}
