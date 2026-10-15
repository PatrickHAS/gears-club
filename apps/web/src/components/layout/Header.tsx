import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

const navigation = [
  { label: "Início", href: "#inicio" },
  { label: "Ranking", href: "#ranking" },
  { label: "Partidas", href: "#partidas" },
  { label: "Campeonatos", href: "#campeonatos" },
];

interface HeaderProps {
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

export function Header({ onLoginClick, onRegisterClick }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, isAuthenticated, signOut } = useAuth();
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-[#101014]/95 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <a href="#inicio" className="flex items-center gap-3">
          <img
            src="/gears-club-logo.png"
            alt="Gears Club"
            className="h-16 w-16 object-contain"
          />

          <span className="text-xl font-black tracking-wide text-white">
            GEARS <span className="text-red-600">CLUB</span>
          </span>
        </a>

        <nav
          aria-label="Navegação principal"
          className="hidden items-center gap-8 lg:flex"
        >
          {navigation.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm font-semibold text-zinc-400 transition hover:text-red-500"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-red-700 bg-red-950 text-sm font-bold text-red-400">
                  {user.username.charAt(0).toUpperCase()}
                </div>

                <span className="text-sm font-semibold text-white">
                  {user.username}
                </span>
              </div>

              <button
                type="button"
                onClick={signOut}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-red-700 hover:text-white"
              >
                Sair
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onLoginClick}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:text-white"
              >
                Entrar
              </button>

              <button
                type="button"
                onClick={onRegisterClick}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-600"
              >
                Criar conta
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          className="rounded-lg border border-zinc-700 p-2 text-white lg:hidden"
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((value) => !value)}
        >
          <span className="text-2xl">{menuOpen ? "✕" : "☰"}</span>
        </button>
      </div>

      {menuOpen && (
        <nav
          id="mobile-navigation"
          aria-label="Navegação mobile"
          className="border-t border-zinc-800 bg-[#101014] px-6 py-5 lg:hidden"
        >
          <div className="flex flex-col gap-5">
            {navigation.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="font-semibold text-zinc-300 hover:text-red-500"
              >
                {item.label}
              </a>
            ))}

            <div className="flex gap-3 border-t border-zinc-800 pt-5">
              <button
                type="button"
                className="flex-1 rounded-lg border border-zinc-700 px-4 py-3 font-semibold"
              >
                Entrar
              </button>

              <button
                type="button"
                className="flex-1 rounded-lg bg-red-600 px-4 py-3 font-semibold"
              >
                Criar conta
              </button>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
