import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import deno from "@deno/vite-plugin";
// https://vite.dev/config/
export default defineConfig({
  base: "./",
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000/",
        changeOrigin: true,
      },
      "/covers": {
        target: "http://localhost:8000/",
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), deno()],
  optimizeDeps: {
    include: ["react/jsx-runtime"],
  },
});
