import { useState } from "react";

import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import type { AuthUser } from "./services/auth.service";
import { Register } from "./pages/Register";

function App() {
  const [page, setPage] = useState<"home" | "login" | "register">("home");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  function handleLogin(authUser: AuthUser, token: string) {
    setUser(authUser);
    setAccessToken(token);
    setPage("home");
  }

  function handleLogout() {
    setUser(null);
    setAccessToken(null);
  }

  if (page === "register") {
    return (
      <Register
        onBack={() => setPage("home")}
        onSuccess={() => {
          setPage("login");
        }}
      />
    );
  }

  if (page === "login") {
    return <Login onLogin={handleLogin} onBack={() => setPage("home")} />;
  }

  return (
    <>
      <Header
        onLoginClick={() => setPage("login")}
        onRegisterClick={() => setPage("register")}
      />

      {user ? (
        <div className="border-b border-red-900 bg-zinc-950 px-6 py-3 text-center text-sm text-white">
          Bem-vindo à arena,{" "}
          <strong className="text-red-500">{user.username}</strong>!
          <button
            type="button"
            onClick={handleLogout}
            className="ml-4 text-zinc-400 underline hover:text-white"
          >
            Sair
          </button>
        </div>
      ) : (
        <div className="border-b border-zinc-800 bg-zinc-950 py-3 text-center">
          <button
            type="button"
            onClick={() => setPage("login")}
            className="font-semibold text-red-500 hover:text-red-400"
          >
            Entrar na minha conta →
          </button>
        </div>
      )}

      <Home />
      <Footer />
    </>
  );
}

export default App;
