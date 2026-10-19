import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// "There is no telemetry." The site measures the open-source funnel (site/src/lib/analytics.ts) so the software
// never has to. test/repo-traffic.test.mjs keeps analytics packages and hosts out of the software; this keeps its
// network honest: every shipped file that can open a connection is listed here with why, and with the place a
// user can read that it does. A new one fails until it is added here, and documented there.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// Code that opens a connection, and markup or CSS that makes the browser fetch from another host.
const NETWORK = /\bfetch\(|\bhttps?\.(request|get)\(|node:(https|net|tls|dgram)\b|\brequire\(['"](https|net|tls|dgram)['"]\)|XMLHttpRequest|sendBeacon|new WebSocket\b|new EventSource\b|\bundici\b|<(link|script|img|iframe)\b[^>]*\b(href|src)=["']https?:|url\(["']?https?:/;

const ALLOWED = {
  'cli.mjs': { why: '`tekjobs up` waits for its own server on 127.0.0.1', doc: ['README.md', 'the app on http://127.0.0.1:8787'] },
  'app/src/api.ts': { why: 'the app calls its own API, same origin', doc: ['README.md', 'serves on 127.0.0.1'] },
  'app/index.html': { why: "the app's three typefaces load from Google Fonts", doc: ['README.md', 'loads its typefaces from Google Fonts'] },
  'scraper/sources.mjs': { why: 'the scan reads public job boards', doc: ['README.md', "the scan's reads of public job boards"] },
  'scraper/sources-extra.mjs': { why: 'the scan reads public job boards, career APIs and feeds', doc: ['README.md', "the scan's reads of public job boards"] },
  'scraper/sources-sites.mjs': { why: 'the scan reads the Google, Apple, Wellfound and Built In listings', doc: ['README.md', 'the Google and Apple career pages'] },
  'scraper/find-board.mjs': { why: 'a moved board is probed through sources.mjs (its `fetch` is fetchCompany)', doc: ['README.md', "the scan's reads of public job boards"] },
  'scraper/import-link.mjs': { why: 'a job link the user pastes is read once', doc: ['README.md', 'one link in, one request or two out'] },
  'scraper/profile.mjs': { why: 'onboarding reads a link the user gives', doc: ['site/content/docs/mcp.md', '`fetch_link`'] },
  'scraper/resume-sync.mjs': { why: 'the resume is synced from a link the user gives', doc: ['cli.mjs', 'tekjobs resume sync [<url|file>]'] },
};

// The software as it ships: the npm package's code, the app's server and its UI source.
function shipped() {
  const files = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return e.name === 'node_modules' || e.name === 'dist' ? [] : files(rel);
    return /\.(mjs|cjs|js|ts|tsx|html|css)$/.test(e.name) ? [rel] : [];
  });
  return ['cli.mjs', 'run.mjs', 'app/index.html', ...files('scraper'), ...files('app/server'), ...files('app/src')];
}

test('every file in the software that can open a connection is a documented one', () => {
  const found = shipped().filter((f) => NETWORK.test(read(f))).sort();
  const unlisted = found.filter((f) => !ALLOWED[f]);
  assert.deepEqual(unlisted, [], `these open connections nobody has documented: ${unlisted.join(', ')}. Add each to ALLOWED with why, and say so where a user reads it.`);
  // And the list stays true: an entry whose file no longer connects is removed, so the list never covers for one.
  assert.deepEqual(Object.keys(ALLOWED).filter((f) => !found.includes(f)), [], 'ALLOWED names a file that no longer makes a network call');
});

test('each allowed network call is written down where a user can read it', () => {
  for (const [file, { doc: [where, phrase] }] of Object.entries(ALLOWED)) {
    assert.ok(read(where).includes(phrase), `${file}: ${where} no longer says "${phrase}"`);
  }
});

test('the site\'s analytics never reach the software', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(!pkg.files.some((f) => f.startsWith('site')), 'the npm package ships the site');
  const offenders = shipped().filter((f) => /from ['"][./]*site\/|lib\/analytics|NEXT_PUBLIC_POSTHOG/.test(read(f)));
  assert.deepEqual(offenders, [], 'the software imports the site\'s analytics');
});

// The guard has to be able to fail: a fetch in a new file is caught, and so is each other way to open a connection.
test('the network pattern catches each way to open a connection', () => {
  for (const code of [
    "await fetch('https://example.com')",
    "https.request({ host: 'x' })",
    "import https from 'node:https'",
    "const net = require('net')",
    'navigator.sendBeacon(url, body)',
    'new WebSocket(url)',
    'new EventSource(url)',
    'new XMLHttpRequest()',
    '<link rel="stylesheet" href="https://fonts.example/css" />',
    '<script src="https://cdn.example/x.js"></script>',
    "@import url('https://fonts.example/css');",
    'background: url(https://img.example/a.png)',
  ]) assert.ok(NETWORK.test(code), code);
  for (const code of [
    "import http from 'node:http'", 'http.createServer(handler)', 'fetchGreenhouse(company, slug)',
    '<a href="https://github.com/Timurtek/tekjobs/discussions" target="_blank">', '<link rel="icon" href="/favicon.svg" />',
  ]) {
    assert.ok(!NETWORK.test(code), `a false alarm: ${code}`);
  }
});
