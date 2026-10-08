#!/usr/bin/env node
// The three landing-page screenshots (site/public/screens): Today, Jobs with the first note open, Pipeline.
// Taken from the sample vault, served by the real API with the built app, at 1440x900 in the dark theme, with
// the Playwright the app's end-to-end tests already install. Rebuild the sample first so its dates are fresh:
//
//   npm run sample && npm run screens
//
// Needs app/dist (cd app && npm run build). Runs its own server on a spare port and stops it; nothing of yours is read.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'site', 'public', 'screens');
const SAMPLE = path.join(ROOT, 'samples', 'vault');
const DIST = path.join(ROOT, 'app', 'dist', 'index.html');
const PORT = Number(process.env.SCREENS_PORT) || 8796;
const BASE = `http://127.0.0.1:${PORT}`;

if (!fs.existsSync(DIST)) { console.error('app/dist is missing: cd app && npm run build, then npm run screens'); process.exit(1); }
const { chromium } = createRequire(import.meta.url)(path.join(ROOT, 'app', 'node_modules', 'playwright'));

// A throwaway home, so the server's machine config and profile settings are never yours.
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tekjobs-screens-'));
const server = spawn(process.execPath, [path.join(ROOT, 'app', 'server', 'index.mjs')], {
  env: { ...process.env, TEKJOBS_PROFILE: SAMPLE, HOME: home, USERPROFILE: home, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
server.stdout.on('data', (d) => { log += d; });
server.stderr.on('data', (d) => { log += d; });
const up = Date.now() + 15000;
while (Date.now() < up) {
  try { const r = await fetch(`${BASE}/api/summary`); if (r.ok) break; } catch { /* not yet */ }
  await new Promise((r) => setTimeout(r, 250));
}
if (!log.includes('TekJobs server')) { server.kill(); console.error(`server did not start on ${PORT}: ${log}`); process.exit(1); }

try {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark' });
  const settle = async () => { await page.waitForLoadState('networkidle'); await page.waitForTimeout(600); };

  await page.goto(`${BASE}/?theme=dark#/today`); await settle();
  await page.waitForSelector('text=Decide on these');
  await page.screenshot({ path: path.join(OUT, 'today.png') });

  await page.goto(`${BASE}/?theme=dark#/jobs`); await settle();
  const first = page.locator('table tbody tr').first();
  await first.waitFor();
  await first.click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, 'jobs.png') });

  await page.goto(`${BASE}/?theme=dark#/pipeline`); await settle();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'pipeline.png') });

  await browser.close();
  for (const f of ['today.png', 'jobs.png', 'pipeline.png']) {
    const b = fs.readFileSync(path.join(OUT, f));
    console.log(`${f}  ${b.readUInt32BE(16)}x${b.readUInt32BE(20)}  ${Math.round(b.length / 1024)} KB`);
  }
} finally {
  server.kill();
}
