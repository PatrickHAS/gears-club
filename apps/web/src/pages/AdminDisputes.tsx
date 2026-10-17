import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  getPendingDisputes,
  getDisputeReview,
  type PendingDispute,
  type DisputeReview,
} from "../services/matches.service";
import { DisputeEvidenceImage } from "../components/DisputeEvidenceImage";
import { ResolveDisputeForm } from "../components/ResolveDisputeForm";

export function AdminDisputes() {
  const { accessToken } = useAuth();

  const [disputes, setDisputes] = useState<PendingDispute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [selectedDispute, setSelectedDispute] = useState<DisputeReview | null>(
    null,
  );

  const [isReviewLoading, setIsReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadDisputes() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await getPendingDisputes(accessToken!);

        if (!cancelled) {
          setDisputes(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Não foi possível carregar as disputas.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDisputes();

    return () => {
      cancelled = true;
    };
  }, [accessToken, reloadKey]);

  async function handleReviewDispute(matchId: string) {
    if (!accessToken) {
      setReviewError("Sua sessão expirou. Faça login novamente.");
      return;
    }

    setIsReviewLoading(true);
    setReviewError(null);
    setSelectedDispute(null);

    try {
      const review = await getDisputeReview(accessToken, matchId);
      setSelectedDispute(review);
    } catch (err) {
      setReviewError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar a disputa.",
      );
    } finally {
      setIsReviewLoading(false);
    }
  }

  function handleDisputeResolved() {
    setSelectedDispute(null);
    setReviewError(null);
    setReloadKey((value) => value + 1);
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-12 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Administração de disputas</h1>

          <p className="mt-3 text-zinc-400">
            Analise partidas contestadas do Gears Club.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setReloadKey((value) => value + 1)}
          disabled={isLoading}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold transition hover:border-amber-500 disabled:opacity-50"
        >
          Atualizar lista
        </button>
      </div>

      {isLoading && (
        <p role="status" className="mt-8 text-zinc-400">
          Carregando disputas...
        </p>
      )}

      {error && !isLoading && (
        <div
          role="alert"
          className="mt-8 rounded-xl border border-red-800 bg-red-950/30 p-5 text-red-300"
        >
          {error}
        </div>
      )}

      {!isLoading && !error && disputes.length === 0 && (
        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
          <p className="text-lg font-semibold">Nenhuma disputa pendente</p>

          <p className="mt-2 text-sm text-zinc-400">
            Não existem partidas aguardando análise administrativa.
          </p>
        </div>
      )}

      {!isLoading && !error && disputes.length > 0 && (
        <div className="mt-8 grid gap-4">
          {disputes.map((dispute) => (
            <article
              key={dispute.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-amber-400">
                    Partida {dispute.id.slice(0, 8)}
                  </h2>

                  <p className="mt-2 text-sm text-zinc-400">
                    Região: {dispute.region} · Demolição 4v4
                  </p>

                  <p className="mt-2 text-sm text-zinc-400">
                    {dispute.participantsCount} jogadores ·{" "}
                    {dispute.reportsCount} reportes · {dispute.evidencesCount}{" "}
                    evidências
                  </p>

                  <p className="mt-2 text-xs text-zinc-500">
                    Atualizada em{" "}
                    {new Date(dispute.updatedAt).toLocaleString("pt-BR")}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-3">
                  <span className="rounded-full border border-amber-700 px-3 py-1 text-xs font-semibold text-amber-400">
                    Em disputa
                  </span>

                  <button
                    type="button"
                    onClick={() => void handleReviewDispute(dispute.id)}
                    disabled={isReviewLoading}
                    className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50"
                  >
                    Analisar disputa
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {isReviewLoading && (
        <p role="status" className="mt-8 text-zinc-400">
          Carregando detalhes da disputa...
        </p>
      )}

      {reviewError && (
        <div
          role="alert"
          className="mt-8 rounded-xl border border-red-800 bg-red-950/30 p-5 text-red-300"
        >
          {reviewError}
        </div>
      )}

      {selectedDispute && (
        <section className="mt-8 rounded-xl border border-zinc-700 bg-zinc-900 p-6">
          <h2 className="text-xl font-bold">
            Análise da partida {selectedDispute.id.slice(0, 8)}
          </h2>

          <p className="mt-3 text-sm text-zinc-400">
            Região: {selectedDispute.region}
          </p>

          <p className="mt-2 text-sm text-zinc-400">
            {selectedDispute.participants.length} jogadores ·{" "}
            {selectedDispute.resultReports.length} reportes ·{" "}
            {selectedDispute.disputeEvidences.length} evidências
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {(["COG", "LOCUST"] as const).map((team) => (
              <div
                key={team}
                className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-5"
              >
                <h3 className="text-lg font-bold text-amber-400">
                  Equipe {team === "COG" ? "COG" : "Locust"}
                </h3>

                <div className="mt-4 space-y-3">
                  {selectedDispute.participants
                    .filter((participant) => participant.team === team)
                    .map((participant) => (
                      <div
                        key={participant.playerProfileId}
                        className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 p-3"
                      >
                        <div>
                          <p className="font-medium">
                            {participant.gamertag ?? "Gamertag não definida"}
                          </p>

                          <p className="text-xs text-zinc-400">
                            País: {participant.country ?? "Não informado"}
                          </p>
                        </div>

                        {participant.isCaptain && (
                          <span className="rounded-md bg-amber-500/15 px-2 py-1 text-xs font-semibold text-amber-400">
                            Capitão
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-bold">Reportes dos capitães</h3>

            {selectedDispute.resultReports.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-400">
                Nenhum reporte encontrado.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {selectedDispute.resultReports.map((report) => {
                  const captain = selectedDispute.participants.find(
                    (participant) =>
                      participant.playerProfileId === report.captainId,
                  );

                  return (
                    <div
                      key={report.id}
                      className="rounded-lg border border-zinc-700 bg-zinc-950/60 p-4"
                    >
                      <p className="font-semibold">
                        {captain?.gamertag ?? "Capitão não identificado"}
                      </p>

                      <p className="mt-2 text-sm text-zinc-400">
                        Declarou como vencedora:
                      </p>

                      <p className="mt-1 font-bold text-amber-400">
                        {report.winnerTeam === "COG" ? "COG" : "Locust"}
                      </p>

                      <p className="mt-3 text-xs text-zinc-500">
                        {new Date(report.createdAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-bold">Evidências da disputa</h3>

            <p className="mt-2 text-sm text-zinc-400">
              Confira se os prints mostram as mesmas oito gamertags registradas
              na partida antes de tomar uma decisão.
            </p>

            {selectedDispute.disputeEvidences.length === 0 ? (
              <p className="mt-4 text-sm text-amber-400">
                Nenhuma evidência foi enviada pelos capitães.
              </p>
            ) : accessToken ? (
              <div className="mt-5 grid gap-5">
                {selectedDispute.disputeEvidences.map((evidence) => {
                  const captain = selectedDispute.participants.find(
                    (participant) =>
                      participant.playerProfileId === evidence.captainId,
                  );

                  return (
                    <DisputeEvidenceImage
                      key={evidence.id}
                      accessToken={accessToken}
                      matchId={selectedDispute.id}
                      evidenceId={evidence.id}
                      captainName={captain?.gamertag ?? "Capitão desconhecido"}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 text-sm text-red-400">
                Sua sessão expirou. Faça login novamente.
              </p>
            )}
          </div>

          {accessToken && (
            <ResolveDisputeForm
              key={selectedDispute.id}
              accessToken={accessToken}
              dispute={selectedDispute}
              onResolved={handleDisputeResolved}
            />
          )}
        </section>
      )}
    </main>
  );
}
