// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5174,
    proxy: {
      "/api": {
        target: "http://backend:8000",
        changeOrigin: true,
        // rewrite not needed because your backend already serves /api/*
        // rewrite: (path) => path,
      },
      "/enums": {
        target: "http://backend:8000",
        changeOrigin: true,
      },
    },
  },
});
