import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { freePort } from './free-port.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'tools', 'repo-traffic.mjs');

// One local server stands in for both GitHub and npm, and records what it was asked.
let server;
let base;
const seen = [];
const routes = {
  '/repos/Timurtek/tekjobs': { stargazers_count: 42, forks_count: 7, subscribers_count: 3 },
  // A full first page, so the script has to ask for the second.
  '/repos/Timurtek/tekjobs/releases?per_page=100&page=1': [
    { tag_name: 'v0.59.0', assets: [{ download_count: 5 }, { download_count: 2 }] },
    ...Array.from({ length: 99 }, (_, i) => ({ tag_name: `v0.0.${i}`, assets: [] })),
  ],
  '/repos/Timurtek/tekjobs/releases?per_page=100&page=2': [{ tag_name: 'v0.0.100', assets: [{ download_count: 4 }] }],
  '/repos/Timurtek/tekjobs/traffic/clones': { count: 30, uniques: 11 },
  '/repos/Timurtek/tekjobs/traffic/views': { count: 200, uniques: 64 },
  '/downloads/point/last-week/%40timurtekb%2Ftekjobs': { downloads: 120 },
  '/downloads/point/last-month/%40timurtekb%2Ftekjobs': { downloads: 480 },
};

test.before(async () => {
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = http.createServer((req, res) => {
    seen.push({ url: req.url, auth: req.headers.authorization || '' });
    if (req.url.includes('/traffic/') && !req.headers.authorization) { res.writeHead(401).end('{}'); return; }
    if (req.url.startsWith('/fail')) { res.writeHead(503).end('{}'); return; }
    const body = routes[req.url];
    if (!body) { res.writeHead(404).end('{}'); return; }
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(body));
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
});
test.after(() => server.close());

// The real entry point, as `npm run traffic` runs it. Async spawn: the server above lives in this process.
function run(args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], {
      cwd: ROOT,
      env: { ...process.env, GITHUB_TOKEN: '', TEKJOBS_GITHUB_API: base, TEKJOBS_NPM_API: base, ...env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

test('without a token it reads every public counter, says clones and views were not read, and sends no auth', async () => {
  seen.length = 0;
  const r = await run([]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^---\ntype: "metric"\n/);
  assert.match(r.stdout, /^stars: 42$/m);
  assert.match(r.stdout, /^forks: 7$/m);
  assert.match(r.stdout, /^release_downloads: 11$/m);
  assert.match(r.stdout, /^npm_downloads_week: 120$/m);
  assert.match(r.stdout, /^npm_downloads_month: 480$/m);
  assert.match(r.stdout, /^clones_14d: null$/m);
  assert.match(r.stdout, /\| Clones, last 14 days \| not read \|/);
  assert.match(r.stdout, /set GITHUB_TOKEN/);
  assert.ok(!seen.some((s) => s.url.includes('/traffic/')), 'asked for traffic with no token');
  assert.ok(seen.every((s) => s.auth === ''), 'sent an authorization header with no token');
});

test('with GITHUB_TOKEN it reads clones and views from the traffic API, with the token', async () => {
  seen.length = 0;
  const r = await run(['--json'], { GITHUB_TOKEN: 'test-token' });
  assert.equal(r.status, 0, r.stderr);
  const t = JSON.parse(r.stdout);
  assert.deepEqual(t.clones_14d, { count: 30, uniques: 11 });
  assert.deepEqual(t.views_14d, { count: 200, uniques: 64 });
  assert.equal(t.stars, 42);
  assert.equal(t.releases, 101);
  assert.equal(t.release_downloads, 11);
  assert.deepEqual(t.notes, []);
  const traffic = seen.filter((s) => s.url.includes('/traffic/'));
  assert.equal(traffic.length, 2);
  assert.ok(traffic.every((s) => s.auth === 'Bearer test-token'));
  // The token goes only to GitHub's traffic endpoints, never to npm.
  assert.ok(seen.filter((s) => s.url.startsWith('/downloads/')).every((s) => s.auth === ''));
});

test('--out writes the same text it prints, as a note a vault can read', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-traffic-'));
  const file = path.join(dir, 'Metrics', 'TekJobs repo traffic.md');
  const r = await run(['--out', file]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.readFileSync(file, 'utf8'), r.stdout);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('--out with no path stops before reading anything', async () => {
  seen.length = 0;
  const r = await run(['--out']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--out needs a file path/);
  assert.equal(seen.length, 0);
});

test('a counter that cannot be read fails the run and names the URL and status', async () => {
  const r = await run([], { TEKJOBS_GITHUB_API: `${base}/fail` });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Could not read the repo traffic: .*\/fail\/repos\/Timurtek\/tekjobs answered 503/);
  assert.equal(r.stdout, '');
});

// The measurement above exists so the software does not have to be instrumented. This keeps it that way.
test('the software stays free of telemetry: no analytics package, no analytics host, and the promise still stands', () => {
  // Package names for the manifests; hosts and SDK imports for the code, since a scraped company can be called
  // Amplitude or Sentry and a comment may say so.
  const PACKAGES = /posthog|@sentry\/|^@?segment|analytics|mixpanel|amplitude|plausible|gtag/i;
  const ANALYTICS = /posthog|google-analytics\.com|googletagmanager\.com|\bgtag\(|segment\.(io|com)|mixpanel\.com|amplitude\.com|plausible\.io|sentry\.io|@sentry\//i;
  for (const manifest of ['package.json', 'app/package.json']) {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, manifest), 'utf8'));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    assert.deepEqual(deps.filter((d) => PACKAGES.test(d)), [], `${manifest} depends on an analytics package`);
  }
  const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' || e.name === 'dist' ? [] : files(p);
    return /\.(mjs|js|ts|tsx|html)$/.test(e.name) ? [p] : [];
  });
  const shipped = [
    path.join(ROOT, 'cli.mjs'), path.join(ROOT, 'run.mjs'),
    ...files(path.join(ROOT, 'scraper')), ...files(path.join(ROOT, 'app', 'server')), ...files(path.join(ROOT, 'app', 'src')),
  ];
  const offenders = shipped.filter((f) => ANALYTICS.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f));
  assert.deepEqual(offenders, [], 'the shipped software names an analytics service');
  assert.ok(fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8').includes('There is no telemetry.'), 'README.md no longer says "There is no telemetry."');
});
