import { useEffect } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { useAuth } from "./contexts/AuthContext";

import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Profile } from "./pages/Profile";
import Ranking from "./pages/Ranking";

function HomeSection() {
  const location = useLocation();

  useEffect(() => {
    const sectionId = location.hash.replace("#", "");

    if (!sectionId) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const section = document.getElementById(sectionId);

    section?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [location.hash, location.key]);

  return <Home />;
}

function App() {
  const navigate = useNavigate();
  const { isLoading, isAuthenticated } = useAuth();

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
    <Routes>
      <Route
        path="/login"
        element={
          <Login onBack={() => navigate("/")} onSuccess={() => navigate("/")} />
        }
      />

      <Route
        path="/cadastro"
        element={
          <Register
            onBack={() => navigate("/")}
            onSuccess={() => navigate("/login")}
          />
        }
      />

      <Route
        path="/*"
        element={
          <div className="flex min-h-screen flex-col bg-[#101014]">
            <Header
              onLoginClick={() => navigate("/login")}
              onRegisterClick={() => navigate("/cadastro")}
              onProfileClick={() => navigate("/perfil")}
              onHomeClick={() => navigate("/")}
              onRankingClick={() => navigate("/ranking")}
              onMatchesClick={() => navigate("/#partidas")}
              onChampionshipsClick={() => navigate("/#campeonatos")}
            />

            <Routes>
              <Route path="/" element={<HomeSection />} />

              <Route path="/ranking" element={<Ranking />} />

              <Route
                path="/perfil"
                element={
                  isAuthenticated ? (
                    <Profile onBack={() => navigate("/")} />
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            <Footer />
          </div>
        }
      />
    </Routes>
  );
}

export default App;
