import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP, classifyLink, createAnalytics, isInstallCommand, pageViewEvents, referrerOrigin } from '../site/src/lib/analytics.ts';

// The site's PostHog client (site/src/lib/analytics.ts), driven with a fake browser that records what it would
// POST. Node strips the file's types; it imports nothing, so it runs here as it runs in the page.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY = { key: 'phc_test', host: 'https://ph.example/' };

function fakeBrowser(over = {}) {
  const sent = [];
  const store = new Map();
  let ids = 0;
  const browser = {
    send: (url, body) => sent.push({ url, body: JSON.parse(body) }),
    storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    randomId: () => `id-${++ids}`,
    doNotTrack: [null, undefined, undefined],
    location: { origin: 'https://tekjobs.timurtek.com', pathname: '/docs/getting-started' },
    referrer: 'https://news.ycombinator.com/item?id=1&user=someone',
    ...over,
  };
  return { browser, sent, store };
}

test('without a key it is a no-op: nothing is sent and no id is made', () => {
  const { browser, sent, store } = fakeBrowser();
  const a = createAnalytics({ key: '', host: 'https://ph.example' }, browser);
  assert.equal(a.enabled, false);
  a.capture('$pageview');
  assert.deepEqual(sent, []);
  assert.equal(store.size, 0);
});

test('Do Not Track or Global Privacy Control turns it off, whatever the key', () => {
  for (const signals of [['1'], [undefined, '1'], [undefined, undefined, true], ['yes']]) {
    const { browser, sent } = fakeBrowser({ doNotTrack: signals });
    const a = createAnalytics(KEY, browser);
    assert.equal(a.enabled, false, JSON.stringify(signals));
    a.capture('install_copied');
    assert.deepEqual(sent, []);
  }
  const { browser } = fakeBrowser({ doNotTrack: ['0', 'unspecified', false] });
  assert.equal(createAnalytics(KEY, browser).enabled, true);
});

test('an event goes to the capture endpoint with app "TekJobs site", the page, and no person profile', () => {
  const { browser, sent } = fakeBrowser();
  createAnalytics(KEY, browser).capture('docs_viewed', { doc: 'getting-started' });
  assert.equal(sent.length, 1);
  const { url, body } = sent[0];
  assert.equal(url, 'https://ph.example/i/v0/e/');
  assert.equal(body.api_key, 'phc_test');
  assert.equal(body.event, 'docs_viewed');
  assert.equal(body.distinct_id, 'id-1');
  assert.match(body.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(body.properties, {
    doc: 'getting-started',
    app: 'TekJobs site',
    $current_url: 'https://tekjobs.timurtek.com/docs/getting-started',
    $pathname: '/docs/getting-started',
    $referrer: 'https://news.ycombinator.com',
    $process_person_profile: false,
  });
  assert.equal(APP, 'TekJobs site');
});

test('an event cannot overwrite app or the privacy properties', () => {
  const { browser, sent } = fakeBrowser();
  createAnalytics(KEY, browser).capture('github_clicked', { app: 'something else', $process_person_profile: true });
  assert.equal(sent[0].body.properties.app, 'TekJobs site');
  assert.equal(sent[0].body.properties.$process_person_profile, false);
});

test('the id is kept for the tab in session storage, and a blocked storage still sends', () => {
  const { browser, sent, store } = fakeBrowser();
  createAnalytics(KEY, browser).capture('$pageview');
  createAnalytics(KEY, browser).capture('$pageview');
  assert.deepEqual(sent.map((s) => s.body.distinct_id), ['id-1', 'id-1']);
  assert.equal(store.get('tekjobs-ph-id'), 'id-1');

  const blocked = fakeBrowser({ storage: { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } } });
  createAnalytics(KEY, blocked.browser).capture('$pageview');
  assert.equal(blocked.sent[0].body.distinct_id, 'id-1');
});

test('the referrer is the referring site only, and none is $direct', () => {
  assert.equal(referrerOrigin('https://www.google.com/search?q=my+name'), 'https://www.google.com');
  assert.equal(referrerOrigin(''), '$direct');
});

test('page views: every page is a $pageview, a docs page is also docs_viewed with its slug', () => {
  assert.deepEqual(pageViewEvents('/'), [{ event: '$pageview', properties: {} }]);
  assert.deepEqual(pageViewEvents('/docs/scoring'), [
    { event: '$pageview', properties: {} },
    { event: 'docs_viewed', properties: { doc: 'scoring' } },
  ]);
  assert.deepEqual(pageViewEvents('/docs').map((e) => e.event), ['$pageview']);
});

test('links: the repo, its releases, npm and Discussions each have their event; other links have none', () => {
  const R = 'https://github.com/Timurtek/tekjobs';
  assert.deepEqual(classifyLink(R), { event: 'github_clicked', properties: { url: R } });
  assert.deepEqual(classifyLink(`${R}/blob/main/scraper/starter/companies-table.md`).event, 'github_clicked');
  assert.deepEqual(classifyLink(`${R}/releases`), { event: 'release_clicked', properties: { target: 'github', url: `${R}/releases` } });
  assert.deepEqual(classifyLink(`${R}/releases/tag/v0.60.0`).event, 'release_clicked');
  assert.deepEqual(classifyLink('https://www.npmjs.com/package/@timurtekb/tekjobs'), {
    event: 'release_clicked', properties: { target: 'npm', url: 'https://www.npmjs.com/package/@timurtekb/tekjobs' },
  });
  assert.deepEqual(classifyLink(`${R}/discussions?q=x#top`), { event: 'discussions_clicked', properties: { url: `${R}/discussions` } });
  for (const other of ['https://github.com/Timurtek/tekjobs-other', 'https://www.timurtek.com', 'https://tekjobs.timurtek.com/docs/mcp', 'not a url']) {
    assert.equal(classifyLink(other), null, other);
  }
});

test('the install command is recognised in each form the site prints it, and nothing else is', () => {
  assert.ok(isInstallCommand('npx @timurtekb/tekjobs init ~/Obsidian/JobSearch --resume ~/Downloads/resume.pdf'));
  assert.ok(isInstallCommand('npm install -g @timurtekb/tekjobs'));
  assert.ok(!isInstallCommand('claude mcp add tekjobs -- tekjobs mcp'));
  assert.ok(!isInstallCommand('tekjobs up'));
  // The landing page's own command block is one of them.
  const content = fs.readFileSync(path.join(ROOT, 'site', 'src', 'content.ts'), 'utf8');
  const pkg = /export const PACKAGE = "([^"]+)"/.exec(content);
  const install = /export const INSTALL = `([^`]*)`/.exec(content);
  assert.ok(pkg && install, 'site/src/content.ts has no PACKAGE or INSTALL');
  assert.ok(isInstallCommand(install[1].replaceAll('${PACKAGE}', pkg[1])), 'the landing page\'s install command would not count as install_copied');
});

// The wiring: Analytics.tsx is mounted on every page, reads the key from flags.ts, and that key is production-only.
test('the site mounts the client on every page, from a production-only key', () => {
  const site = (rel) => fs.readFileSync(path.join(ROOT, 'site', 'src', rel), 'utf8');
  assert.match(site('app/layout.tsx'), /<Analytics \/>/);
  assert.match(site('components/Analytics.tsx'), /createAnalytics\(posthog,/);
  assert.match(site('lib/flags.ts'), /key: process\.env\.NEXT_PUBLIC_VERCEL_ENV === "production" \? process\.env\.NEXT_PUBLIC_POSTHOG_KEY/);
});
