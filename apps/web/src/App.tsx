import { useState } from "react";

import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";

import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";

import { useAuth } from "./contexts/AuthContext";

type Page = "home" | "login" | "register";

function App() {
  const [page, setPage] = useState<Page>("home");

  const { user, isAuthenticated, signOut } = useAuth();

  if (page === "login") {
    return (
      <Login onBack={() => setPage("home")} onSuccess={() => setPage("home")} />
    );
  }

  if (page === "register") {
    return (
      <Register
        onBack={() => setPage("home")}
        onSuccess={() => setPage("login")}
      />
    );
  }

  return (
    <>
      <Header
        onLoginClick={() => setPage("login")}
        onRegisterClick={() => setPage("register")}
      />

      {isAuthenticated && user ? (
        <div className="border-b border-red-900 bg-zinc-950 px-6 py-3 text-center text-sm text-white">
          Bem-vindo à arena,{" "}
          <strong className="text-red-500">{user.username}</strong>!
          <button
            type="button"
            onClick={signOut}
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
