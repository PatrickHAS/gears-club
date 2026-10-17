import { useState } from "react";
import {
  resolveDispute,
  type DisputeReview,
  type MatchTeam,
} from "../services/matches.service";

interface ResolveDisputeFormProps {
  accessToken: string;
  dispute: DisputeReview;
  onResolved: () => void;
}

export function ResolveDisputeForm({
  accessToken,
  dispute,
  onResolved,
}: ResolveDisputeFormProps) {
  const [winnerTeam, setWinnerTeam] = useState<MatchTeam | "">("");
  const [reason, setReason] = useState("");
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [gamertagsVerified, setGamertagsVerified] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid =
    winnerTeam !== "" &&
    reason.trim().length >= 10 &&
    reason.trim().length <= 2000 &&
    selectedEvidenceIds.length > 0 &&
    gamertagsVerified;

  function toggleEvidence(evidenceId: string) {
    setSelectedEvidenceIds((current) =>
      current.includes(evidenceId)
        ? current.filter((id) => id !== evidenceId)
        : [...current, evidenceId],
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isValid || !winnerTeam || isSubmitting) return;

    const confirmed = window.confirm(
      `Confirmar a vitória da equipe ${winnerTeam}?\n\n` +
        "Esta decisão homologará o resultado e atualizará o ELO dos oito jogadores.",
    );

    if (!confirmed) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await resolveDispute(accessToken, dispute.id, {
        winnerTeam,
        reason: reason.trim(),
        evidenceIds: selectedEvidenceIds,
        gamertagsVerified: true,
      });

      onResolved();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível resolver a disputa.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="mt-8 rounded-xl border border-amber-700/50 bg-zinc-950/70 p-6"
    >
      <h3 className="text-xl font-bold text-amber-400">
        Resolução administrativa
      </h3>

      <p className="mt-2 text-sm text-zinc-400">
        Confira os reportes e as imagens antes de homologar o resultado.
      </p>

      <fieldset disabled={isSubmitting} className="mt-6">
        <legend className="font-semibold">Equipe vencedora</legend>

        <div className="mt-3 flex gap-6">
          {(["COG", "LOCUST"] as const).map((team) => (
            <label
              key={team}
              className="flex cursor-pointer items-center gap-2"
            >
              <input
                type="radio"
                name="winnerTeam"
                value={team}
                checked={winnerTeam === team}
                onChange={() => setWinnerTeam(team)}
              />
              {team === "COG" ? "COG" : "Locust"}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6">
        <label htmlFor="dispute-reason" className="block font-semibold">
          Justificativa da decisão
        </label>

        <textarea
          id="dispute-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={isSubmitting}
          maxLength={2000}
          rows={5}
          placeholder="Explique quais evidências comprovam o resultado..."
          className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-white outline-none focus:border-amber-500"
        />

        <p className="mt-1 text-xs text-zinc-400">
          {reason.trim().length}/2000 caracteres (mínimo de 10)
        </p>
      </div>

      <fieldset disabled={isSubmitting} className="mt-6">
        <legend className="font-semibold">
          Evidências utilizadas na decisão
        </legend>

        {dispute.disputeEvidences.length === 0 ? (
          <p className="mt-3 text-sm text-red-400">
            Não existem evidências. Esta disputa não pode ser homologada.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {dispute.disputeEvidences.map((evidence) => {
              const captain = dispute.participants.find(
                (participant) =>
                  participant.playerProfileId === evidence.captainId,
              );

              return (
                <label
                  key={evidence.id}
                  className="flex cursor-pointer items-center gap-3"
                >
                  <input
                    type="checkbox"
                    checked={selectedEvidenceIds.includes(evidence.id)}
                    onChange={() => toggleEvidence(evidence.id)}
                  />

                  <span className="text-sm">
                    Print de {captain?.gamertag ?? "Capitão desconhecido"} —{" "}
                    {evidence.id.slice(0, 8)}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </fieldset>

      <label className="mt-6 flex items-start gap-3">
        <input
          type="checkbox"
          checked={gamertagsVerified}
          onChange={(event) => setGamertagsVerified(event.target.checked)}
          disabled={isSubmitting}
          className="mt-1"
        />

        <span className="text-sm text-zinc-300">
          Confirmo que analisei os prints e verifiquei que as oito gamertags
          correspondem exatamente aos jogadores registrados nesta partida.
        </span>
      </label>

      {error && (
        <p role="alert" className="mt-5 text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!isValid || isSubmitting}
        className="mt-6 rounded-lg bg-amber-500 px-6 py-3 font-bold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSubmitting ? "Homologando resultado..." : "Homologar resultado"}
      </button>
    </form>
  );
}
