import { useState } from "react";

import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";

import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";

type Page = "home" | "login" | "register";

function App() {
  const [page, setPage] = useState<Page>("home");

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

      <Home />
      <Footer />
    </>
  );
}

export default App;
