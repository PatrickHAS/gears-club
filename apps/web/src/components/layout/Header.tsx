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
  onProfileClick: () => void;
  onHomeClick: () => void;
}

export function Header({
  onLoginClick,
  onRegisterClick,
  onProfileClick,
  onHomeClick,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const { user, isAuthenticated, signOut } = useAuth();

  function handleLogin() {
    setMenuOpen(false);
    onLoginClick();
  }

  function handleRegister() {
    setMenuOpen(false);
    onRegisterClick();
  }

  function handleProfile() {
    setMenuOpen(false);
    onProfileClick();
  }

  function handleHome() {
    setMenuOpen(false);
    onHomeClick();
  }

  async function handleLogout() {
    setMenuOpen(false);
    await signOut();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-[#101014]/95 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <a
          href="#inicio"
          onClick={(event) => {
            event.preventDefault();
            handleHome();
          }}
          className="flex items-center gap-3"
        >
          <img
            src="/gears-club-logo.png"
            alt="Gears Club"
            className="h-16 w-16 object-contain"
          />

          <span className="text-xl font-black tracking-wide text-white">
            GEARS <span className="text-red-600">CLUB</span>
          </span>
        </a>

        {/* Navegação desktop */}
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

        {/* Autenticação desktop */}
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
                onClick={handleProfile}
                className="rounded-lg border border-red-800 px-4 py-2 text-sm font-semibold text-red-400 transition hover:border-red-600 hover:text-white"
              >
                Meu Perfil
              </button>

              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-red-700 hover:text-white"
              >
                Sair
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleLogin}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:text-white"
              >
                Entrar
              </button>

              <button
                type="button"
                onClick={handleRegister}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-600"
              >
                Criar conta
              </button>
            </div>
          )}
        </div>

        {/* Botão menu mobile */}
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

      {/* Menu mobile */}
      {menuOpen && (
        <nav
          id="mobile-navigation"
          aria-label="Navegação mobile"
          className="border-t border-zinc-800 bg-[#101014] px-6 py-5 lg:hidden"
        >
          <div className="flex flex-col gap-5">
            {/* Links */}
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

            {/* Autenticação mobile */}
            <div className="border-t border-zinc-800 pt-5">
              {isAuthenticated && user ? (
                <div className="flex flex-col gap-4">
                  {/* Jogador conectado */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-red-700 bg-red-950 text-lg font-bold text-red-400">
                      {user.username.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-medium text-zinc-400">
                        Jogador conectado
                      </p>

                      <p className="truncate font-bold text-white">
                        {user.username}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleProfile}
                    className="w-full rounded-lg border border-zinc-700 px-4 py-3 text-left font-semibold text-white transition hover:border-red-600"
                  >
                    Meu Perfil
                  </button>

                  {/* Logout */}
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="w-full rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 font-semibold text-red-400 transition hover:bg-red-900/50 hover:text-white"
                  >
                    Sair da conta
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  {/* Login */}
                  <button
                    type="button"
                    onClick={handleLogin}
                    className="flex-1 rounded-lg border border-zinc-700 px-4 py-3 font-semibold text-white transition hover:border-red-600"
                  >
                    Entrar
                  </button>

                  {/* Cadastro */}
                  <button
                    type="button"
                    onClick={handleRegister}
                    className="flex-1 rounded-lg bg-red-600 px-4 py-3 font-semibold text-white transition hover:bg-red-500"
                  >
                    Criar conta
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
