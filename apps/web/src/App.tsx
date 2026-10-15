function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#090909] px-6 text-center">
      <img
        src="/gears-club-logo.png"
        alt="Gears Club"
        className="w-full max-w-[380px] object-contain"
      />

      <h1 className="mt-4 text-3xl font-black tracking-wider text-white md:text-5xl">
        A NOVA ARENA COMPETITIVA
      </h1>

      <p className="mt-5 max-w-xl text-lg leading-relaxed text-zinc-400">
        Sua próxima batalha começa aqui. Compita, evolua no ranking e conquiste
        seu lugar entre os melhores jogadores.
      </p>

      <div className="mt-9 flex flex-wrap justify-center gap-4">
        <button
          type="button"
          className="rounded-lg bg-red-600 px-8 py-4 font-bold text-white transition hover:bg-red-700"
        >
          EM BREVE
        </button>
      </div>

      <p className="mt-10 text-sm tracking-widest text-zinc-600">
        GEARS CLUB © 2026
      </p>
    </main>
  );
}

export default App;
