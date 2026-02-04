import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { setupGlobalErrorHandler } from "@/lib/global-error-handler";
import App from "./App.tsx";
import "./index.css";

// Inicializar handler global de erros
setupGlobalErrorHandler();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
