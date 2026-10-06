import { Route, Routes, useLocation } from "react-router-dom";
import ChatPanel from "./components/ChatPanel";
import DanTrot from "./components/DanTrot";
import Footer from "./components/Footer";
import NavBar from "./components/NavBar";
import ScrollProgress from "./components/ScrollProgress";
import Ticker from "./components/Ticker";
import About from "./pages/About";
import Bag from "./pages/Bag";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ProductDetail from "./pages/ProductDetail";
import Products from "./pages/Products";
import Signup from "./pages/Signup";

export default function App() {
  const location = useLocation();

  return (
    <div className="app-shell">
      <ScrollProgress />
      <NavBar />
      <Ticker />
      {/* keyed on path so each navigation replays the cross-fade */}
      <main key={location.pathname} className="page-transition">
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:productId" element={<ProductDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/bag" element={<Bag />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="*" element={<p className="state-msg">Page not found.</p>} />
        </Routes>
      </main>
      <Footer />
      {/* trots across the bottom of the window every so often, on every page */}
      <DanTrot />
      <ChatPanel />
    </div>
  );
}
