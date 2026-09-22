import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import pkg from "../package.json";

// "@" is src, matching tsconfig paths. A root-relative alias needs no Node imports, so the config typechecks without @types/node.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": "/src" } },
  // The version shown in the sidebar footer is the root package's, which semantic-release bumps.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // The API lives in server/index.mjs (`npm run server`). In dev, Vite forwards /api to it.
  server: { proxy: { "/api": "http://127.0.0.1:8787" } },
});
