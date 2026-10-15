export function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-[#101014]">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-center md:flex-row">
        <p className="text-sm text-zinc-500">
          © {new Date().getFullYear()} Gears Club. Todos os direitos reservados.
        </p>

        <p className="text-sm text-zinc-500">
          Plataforma competitiva independente.
        </p>
      </div>
    </footer>
  );
}
