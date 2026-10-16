import { useEffect, useState } from "react";
import {
  getLeaderboard,
  type LeaderboardResponse,
} from "../services/ratings.service";

const COUNTRIES = [
  { code: "", name: "Todos os países" },
  { code: "BR", name: "🇧🇷 Brasil" },
  { code: "US", name: "🇺🇸 Estados Unidos" },
  { code: "MX", name: "🇲🇽 México" },
  { code: "AR", name: "🇦🇷 Argentina" },
  { code: "CL", name: "🇨🇱 Chile" },
  { code: "UY", name: "🇺🇾 Uruguai" },
];

function countryFlag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "🌎";

  return String.fromCodePoint(
    ...[...code].map((letter) => 127397 + letter.charCodeAt(0)),
  );
}

export default function Ranking() {
  const [country, setCountry] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadRanking() {
      setLoading(true);
      setError("");

      try {
        const result = await getLeaderboard(country || undefined, page);

        if (active) {
          setData(result);
        }
      } catch {
        if (active) {
          setError("Não foi possível carregar o ranking.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadRanking();

    return () => {
      active = false;
    };
  }, [country, page]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 text-white">
      <div className="mb-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-red-500">
          Gears Club
        </p>

        <h1 className="text-3xl font-bold">Ranking de jogadores</h1>

        <p className="mt-2 text-zinc-400">
          Classificação competitiva por ELO. Vitórias, derrotas e taxa de
          vitórias.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <label className="flex flex-col gap-2 text-sm text-zinc-300">
          Filtrar por país
          <select
            value={country}
            onChange={(event) => {
              setCountry(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white"
          >
            {COUNTRIES.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <p className="text-sm text-zinc-400">
          {data?.total ?? 0} jogadores classificados
        </p>
      </div>

      {loading ? (
        <p className="py-10 text-center text-zinc-400">Carregando ranking...</p>
      ) : error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-900 bg-red-950/40 p-5 text-red-300"
        >
          {error}
        </p>
      ) : !data || data.players.length === 0 ? (
        <p className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
          Nenhum jogador encontrado neste ranking.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-zinc-900 text-zinc-400">
                <tr>
                  <th className="px-4 py-4">Posição</th>
                  <th className="px-4 py-4">Jogador</th>
                  <th className="px-4 py-4">ELO</th>
                  <th className="px-4 py-4">Vitórias</th>
                  <th className="px-4 py-4">Derrotas</th>
                  <th className="px-4 py-4">VT</th>
                </tr>
              </thead>

              <tbody>
                {data.players.map((player) => (
                  <tr
                    key={`${player.country}-${player.gamertag}`}
                    className="border-t border-zinc-800 bg-zinc-950 hover:bg-zinc-900"
                  >
                    <td className="px-4 py-4 font-bold text-red-400">
                      #{player.position}
                    </td>

                    <td className="px-4 py-4">
                      <span className="mr-2">
                        {countryFlag(player.country)}
                      </span>
                      <span className="font-semibold">{player.gamertag}</span>
                    </td>

                    <td className="px-4 py-4 font-bold">{player.elo}</td>

                    <td className="px-4 py-4 text-green-400">{player.wins}</td>

                    <td className="px-4 py-4 text-red-400">{player.losses}</td>

                    <td className="px-4 py-4">{player.winRate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((current) => current - 1)}
              className="rounded-lg bg-zinc-800 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anterior
            </button>

            <span className="text-sm text-zinc-400">
              Página {data.page} de {data.totalPages}
            </span>

            <button
              type="button"
              disabled={page >= data.totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg bg-zinc-800 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </>
      )}
    </main>
  );
}
