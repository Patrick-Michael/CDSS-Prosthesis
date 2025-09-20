// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5174,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        // if you had a prefix on the backend, you'd rewrite here
        // rewrite: (path) => path.replace(/^\/api/, "/api"),
      },
      "/enums": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
