import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { Home } from "./pages/Home";

function App() {
  return (
    <div className="flex min-h-screen flex-col bg-[#090909]">
      <Header />
      <Home />
      <Footer />
    </div>
  );
}

export default App;
