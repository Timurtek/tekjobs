// One browser run of the built app against a copy of the fictional sample vault: the pages load, a job opens,
// the copy panel opens and stays inside its box. `npm run test:e2e` here; CI runs it after the build.
import { defineConfig } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const sample = path.join(here, "..", "samples", "vault");
// A fresh copy per run, so nothing the app writes lands in the repository's sample.
const vault = fs.mkdtempSync(path.join(os.tmpdir(), "tekjobs-e2e-"));
fs.cpSync(sample, vault, { recursive: true });
const port = 8799;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width: 1440, height: 900 }, colorScheme: "dark" },
  webServer: {
    command: "node server/index.mjs",
    url: `http://127.0.0.1:${port}/api/summary`,
    env: { TEKJOBS_PROFILE: vault, PORT: String(port) },
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
