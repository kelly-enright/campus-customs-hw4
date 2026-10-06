import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./lib/AuthContext";
import { BagProvider } from "./lib/BagContext";
import { ChatResultsProvider } from "./lib/ChatResultsContext";
import "./index.css";
import "./styles/theme.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <BagProvider>
          <ChatResultsProvider>
            <App />
          </ChatResultsProvider>
        </BagProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
