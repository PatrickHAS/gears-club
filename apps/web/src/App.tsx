import { useState } from "react";

import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { useAuth } from "./contexts/AuthContext";

import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";

type Page = "home" | "login" | "register";

function App() {
  const [page, setPage] = useState<Page>("home");
  const { isLoading } = useAuth();

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

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="animate-pulse text-lg font-semibold text-red-500">
          Carregando Gears Club...
        </p>
      </div>
    );
  }

  return (
    <>
      <Header
        onLoginClick={() => setPage("login")}
        onRegisterClick={() => setPage("register")}
      />

      <Home />
      <Footer />
    </>
  );
}

export default App;
