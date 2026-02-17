import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@workspace/ui/globals.css";
import App from "./app.tsx";

const root = document.getElementById("app");

if (!root) {
  throw new Error("Root element #app not found");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
