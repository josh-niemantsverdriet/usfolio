import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: { include: ["tests/**/*.test.ts"] },
  build: {
    rollupOptions: {
      output: { manualChunks: { auth: ["@auth0/auth0-react"] } },
    },
  },
  server: { proxy: { "/api": "http://localhost:7071" } },
});
