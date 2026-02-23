import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@workspace/ui/globals.css";
import { ErrorBoundary } from "react-error-boundary";
import App from "@/app";
import { GlobalErrorFallback } from "@/components/shared/global-error-fallback";

const root = document.getElementById("app");

if (!root) {
  throw new Error("Root element #app not found");
}

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary
      FallbackComponent={GlobalErrorFallback}
      onReset={() => {
        // Optional: reset logic like clearing localStorage or certain state actors
        window.location.reload();
      }}
    >
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
