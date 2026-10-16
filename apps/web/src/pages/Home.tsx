import { MatchmakingQueue } from "../components/matchmaking/MatchmakingQueue";

export function Home() {
  return (
    <main id="inicio" className="flex-1">
      <section className="flex min-h-[75vh] flex-col items-center justify-center px-6 py-16 text-center">
        <img
          src="/gears-club-logo.png"
          alt="Logo Gears Club"
          className="mb-8 w-full max-w-[320px] object-contain"
        />

        <h1 className="max-w-5xl text-4xl font-black tracking-wide text-white md:text-6xl">
          A NOVA ARENA <span className="text-red-600">COMPETITIVA</span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
          Sua próxima batalha começa aqui. Compita, evolua no ranking e
          conquiste seu lugar entre os melhores jogadores.
        </p>

        <div className="mt-10">
          <span className="inline-block rounded-lg border border-red-600/40 bg-red-600/10 px-8 py-4 font-bold tracking-widest text-red-500">
            EM DESENVOLVIMENTO
          </span>
        </div>
      </section>

      <section
        id="ranking"
        className="scroll-mt-24 border-t border-zinc-800 px-6 py-20 text-center"
      >
        <h2 className="text-3xl font-bold text-white">Ranking competitivo</h2>
        <p className="mt-4 text-zinc-400">
          Em breve, acompanhe sua evolução e posição no ranking.
        </p>
      </section>

      <section
        id="partidas"
        className="scroll-mt-24 border-t border-zinc-800 px-6 py-20 text-center"
      >
        <h2 className="text-3xl font-bold text-white">Matchmaking</h2>
        <p className="mt-4 text-zinc-400">
          Encontre partidas competitivas e enfrente novos desafios.
        </p>
        <MatchmakingQueue />
      </section>

      <section
        id="campeonatos"
        className="scroll-mt-24 border-t border-zinc-800 px-6 py-20 text-center"
      >
        <h2 className="text-3xl font-bold text-white">Campeonatos</h2>
        <p className="mt-4 text-zinc-400">
          Participe de competições organizadas pela comunidade.
        </p>
      </section>
    </main>
  );
}
