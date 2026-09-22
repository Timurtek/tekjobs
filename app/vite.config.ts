import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// "@" is src, matching tsconfig paths. A root-relative alias needs no Node imports, so the config typechecks without @types/node.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": "/src" } },
  // The API lives in server/index.mjs (`npm run server`). In dev, Vite forwards /api to it.
  server: { proxy: { "/api": "http://127.0.0.1:8787" } },
});
