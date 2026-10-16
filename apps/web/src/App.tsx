import { useEffect, useState } from "react";

import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { useAuth } from "./contexts/AuthContext";

import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Profile } from "./pages/Profile";
import Ranking from "./pages/Ranking";

type Page = "home" | "login" | "register" | "profile" | "ranking";

function App() {
  const [page, setPage] = useState<Page>("home");
  const { isLoading, isAuthenticated } = useAuth();

  const [homeSection, setHomeSection] = useState<string | null>(null);

  useEffect(() => {
    if (page !== "home" || !homeSection) return;

    const section = document.getElementById(homeSection);

    if (section) {
      section.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      setHomeSection(null);
    }
  }, [page, homeSection]);

  function navigateToHomeSection(section: string) {
    setHomeSection(section);
    setPage("home");
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

  function renderPage() {
    switch (page) {
      case "ranking":
        return <Ranking />;

      case "profile":
        return isAuthenticated ? (
          <Profile onBack={() => setPage("home")} />
        ) : (
          <Home />
        );

      case "home":
      default:
        return <Home />;
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#101014]">
      <Header
        onLoginClick={() => setPage("login")}
        onRegisterClick={() => setPage("register")}
        onProfileClick={() => setPage("profile")}
        onHomeClick={() => {
          setPage("home");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onRankingClick={() => {
          setPage("ranking");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onMatchesClick={() => navigateToHomeSection("partidas")}
        onChampionshipsClick={() => navigateToHomeSection("campeonatos")}
      />

      {renderPage()}

      <Footer />
    </div>
  );
}

export default App;
