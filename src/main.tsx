import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { API_BASE } from "./config.ts";

console.log('[LocalMusic] App starting...');
console.log('[LocalMusic] API_BASE:', API_BASE);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
