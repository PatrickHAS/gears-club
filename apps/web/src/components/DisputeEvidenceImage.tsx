import { useEffect, useState } from "react";
import { getDisputeEvidenceImage } from "../services/matches.service";

interface DisputeEvidenceImageProps {
  accessToken: string;
  matchId: string;
  evidenceId: string;
  captainName: string;
}

export function DisputeEvidenceImage({
  accessToken,
  matchId,
  evidenceId,
  captainName,
}: DisputeEvidenceImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;

    setImageUrl(null);
    setError(null);
    setIsLoading(true);

    async function loadImage() {
      try {
        const blob = await getDisputeEvidenceImage(
          accessToken,
          matchId,
          evidenceId,
          controller.signal,
        );

        if (controller.signal.aborted) return;

        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      } catch (err) {
        if (controller.signal.aborted) return;

        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível carregar a imagem.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadImage();

    return () => {
      controller.abort();

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [accessToken, matchId, evidenceId]);

  return (
    <article className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-4">
      <p className="mb-3 text-sm font-semibold text-amber-400">
        Evidência enviada por {captainName}
      </p>

      {isLoading && (
        <p role="status" className="text-sm text-zinc-400">
          Carregando imagem...
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      {imageUrl && (
        <img
          src={imageUrl}
          alt={`Evidência da disputa enviada por ${captainName}`}
          className="max-h-[600px] w-full rounded-lg object-contain"
        />
      )}
    </article>
  );
}
