import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { API_BASE, isNativePlatform } from "./config.ts";

// Debug logging for Android
console.log('[LocalMusic] App starting...');
console.log('[LocalMusic] isNativePlatform:', isNativePlatform());
console.log('[LocalMusic] API_BASE:', API_BASE);
console.log('[LocalMusic] localStorage api_base_url:', localStorage.getItem('api_base_url'));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
