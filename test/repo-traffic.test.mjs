import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { freePort } from './free-port.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'tools', 'repo-traffic.mjs');

// One local server stands in for GitHub, and records what it was asked. A path prefix picks a scenario: `/fail`
// answers 503, `/bad-*` answers 200 with a body GitHub would never send.
let server;
let base;
const seen = [];
const routes = {
  '/repos/Timurtek/tekjobs': { stargazers_count: 42, forks_count: 7 },
  // A full first page, so the script has to ask for the second.
  '/repos/Timurtek/tekjobs/releases?per_page=100&page=1': [
    { tag_name: 'v0.59.0', assets: [{ download_count: 5 }, { download_count: 2 }] },
    ...Array.from({ length: 99 }, (_, i) => ({ tag_name: `v0.0.${i}`, assets: [] })),
  ],
  '/repos/Timurtek/tekjobs/releases?per_page=100&page=2': [{ tag_name: 'v0.0.100', assets: [{ download_count: 4 }] }],
  '/repos/Timurtek/tekjobs/traffic/clones': { count: 30, uniques: 11 },
};
const malformed = {
  '/bad-stars': { '/repos/Timurtek/tekjobs': { stargazers_count: '42', forks_count: 7 } },
  '/bad-releases': { '/repos/Timurtek/tekjobs/releases?per_page=100&page=1': { message: 'not a list' } },
  '/bad-downloads': { '/repos/Timurtek/tekjobs/releases?per_page=100&page=1': [{ assets: [{ download_count: -1 }] }] },
  '/bad-clones': { '/repos/Timurtek/tekjobs/traffic/clones': { count: 30, uniques: null } },
};

test.before(async () => {
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = http.createServer((req, res) => {
    seen.push({ url: req.url, auth: req.headers.authorization || '' });
    if (req.url.includes('/traffic/') && !req.headers.authorization) { res.writeHead(401).end('{}'); return; }
    if (req.url.startsWith('/fail')) { res.writeHead(503).end('{}'); return; }
    const scenario = Object.keys(malformed).find((p) => req.url.startsWith(p + '/'));
    const url = scenario ? req.url.slice(scenario.length) : req.url;
    const body = (scenario && malformed[scenario][url]) || routes[url];
    if (!body) { res.writeHead(404).end('{}'); return; }
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(body));
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
});
test.after(() => server.close());

const ENV = (env) => ({ ...process.env, GITHUB_TOKEN: '', TEKJOBS_GITHUB_API: base, ...env });

function collect(child) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

// The real entry point. Async spawn: the server above lives in this process.
const run = (args, env = {}) => collect(spawn(process.execPath, [SCRIPT, ...args], { cwd: ROOT, env: ENV(env) }));

test('npm run traffic runs the script: the package wiring the docs give is the one that works', async () => {
  // One command string through the shell, so npm resolves the same way it does for a person (npm.cmd on Windows).
  const r = await collect(spawn('npm run traffic -- --json', { cwd: ROOT, env: ENV({}), shell: true }));
  assert.equal(r.status, 0, r.stderr);
  const t = JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
  assert.equal(t.stars, 42);
  assert.equal(t.release_downloads, 11);
});

test('without a token it reads stars, forks and release downloads, says clones were not read, and sends no auth', async () => {
  seen.length = 0;
  const r = await run([]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^---\ntype: "metric"\n/);
  assert.match(r.stdout, /^stars: 42$/m);
  assert.match(r.stdout, /^forks: 7$/m);
  assert.match(r.stdout, /^releases: 101$/m);
  assert.match(r.stdout, /^release_downloads: 11$/m);
  assert.match(r.stdout, /^clones_14d: null$/m);
  assert.match(r.stdout, /\| Clones, last 14 days \| not read \|/);
  assert.match(r.stdout, /set GITHUB_TOKEN/);
  assert.ok(!seen.some((s) => s.url.includes('/traffic/')), 'asked for traffic with no token');
  assert.ok(seen.every((s) => s.auth === ''), 'sent an authorization header with no token');
});

test('with GITHUB_TOKEN it reads clones from the traffic API, sending the token only there', async () => {
  seen.length = 0;
  const r = await run(['--json'], { GITHUB_TOKEN: 'test-token' });
  assert.equal(r.status, 0, r.stderr);
  const t = JSON.parse(r.stdout);
  assert.deepEqual(t.clones_14d, { count: 30, uniques: 11 });
  assert.equal(t.stars, 42);
  assert.equal(t.forks, 7);
  assert.equal(t.releases, 101);
  assert.equal(t.release_downloads, 11);
  assert.deepEqual(t.notes, []);
  // Only the four counters Tek named, and nothing else.
  assert.deepEqual(Object.keys(t).sort(), ['clones_14d', 'forks', 'notes', 'read', 'release_downloads', 'releases', 'repo', 'stars']);
  const traffic = seen.filter((s) => s.url.includes('/traffic/'));
  assert.equal(traffic.length, 1);
  assert.equal(traffic[0].auth, 'Bearer test-token');
  assert.ok(seen.filter((s) => !s.url.includes('/traffic/')).every((s) => s.auth === ''), 'the token went to a public endpoint');
});

test('a counter that cannot be read fails the run and names the URL and status', async () => {
  const r = await run([], { TEKJOBS_GITHUB_API: `${base}/fail` });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Could not read the repo traffic: .*\/fail\/repos\/Timurtek\/tekjobs answered 503/);
  assert.equal(r.stdout, '');
});

for (const [scenario, expected, env] of [
  ['/bad-stars', /\/bad-stars\/repos\/Timurtek\/tekjobs gave stargazers_count = "42", not a count/, {}],
  ['/bad-releases', /releases\?per_page=100&page=1 did not answer with a list of releases/, {}],
  ['/bad-downloads', /release 0 asset 0 download_count = -1, not a count/, {}],
  ['/bad-clones', /traffic\/clones gave uniques = null, not a count/, { GITHUB_TOKEN: 'test-token' }],
]) {
  test(`a malformed answer from GitHub (${scenario.slice(1)}) fails the run by endpoint and field, printing no number`, async () => {
    const r = await run([], { TEKJOBS_GITHUB_API: base + scenario, ...env });
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stderr, expected);
    assert.equal(r.stdout, '');
  });
}

test('there is no --out: the script writes nothing, it only prints', () => {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  assert.ok(!/node:fs|writeFile|--out/.test(src), 'tools/repo-traffic.mjs writes files again');
});

// docs/analytics.md is the packet's contract: the one number with its target, how to read it, what GA4 measures and
// where, every repo counter, and the privacy promise. Each of these must stay.
test('docs/analytics.md keeps the one number, its target, the GA4 inventory, the repo counters and the privacy section', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'docs', 'analytics.md'), 'utf8');
  const need = {
    'the one number': /## The one number[\s\S]*found_interviews/,
    'its target': /\*\*Target: 2 interviews per month\*\*/,
    'how to count it': /→ \*\*interviewing\*\*[\s\S]*added_by:/,
    'the GA4 events': /`page_view`[\s\S]*`session_start`/,
    'where GA4 is read': /G-DX8B8DCTGF[\s\S]*Reports → Engagement → Pages and screens/,
    'the GA4 evidence': /docs\/evidence\/ga4-page-view-tekjobs\.json/,
    'every repo counter': /`stars`[\s\S]*`forks`[\s\S]*`release_downloads`[\s\S]*`clones_14d`/,
    'the privacy section': /## Privacy[\s\S]*The software sends nothing/,
  };
  const missing = Object.entries(need).filter(([, re]) => !re.test(doc)).map(([k]) => k);
  assert.deepEqual(missing, [], `docs/analytics.md lost: ${missing.join(', ')}`);
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
