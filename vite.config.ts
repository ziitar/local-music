import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import deno from "@deno/vite-plugin";

// 子路径配置：从 .env 的 VITE_BASE_PATH 读取，默认 "/"
const base = (process.env.VITE_BASE_PATH ?? "/").replace(/\/+$/, "") + "/";

export default defineConfig({
  base,
  server: {
    port: 5173,
    proxy: {
      [`^${base}api`]: {
        target: "http://localhost:8000/",
        changeOrigin: true,
        rewrite: (path) => path.replace(new RegExp(`^${base.replace(/\//g, "\\/")}`), "/"),
      },
      [`^${base}covers`]: {
        target: "http://localhost:8000/",
        changeOrigin: true,
        rewrite: (path) => path.replace(new RegExp(`^${base.replace(/\//g, "\\/")}`), "/"),
      },
    },
  },
  plugins: [react(), deno()],
  optimizeDeps: {
    include: ["react/jsx-runtime"],
  },
});
