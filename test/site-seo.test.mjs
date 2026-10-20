import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRIVATE, SITE_NAME, SOCIAL_IMAGE, articleLd, homeLd, jsonLd, pageMeta, robotsFor, sitemapFor } from '../site/src/lib/seo.ts';

// What search engines read on the site (site/src/lib/seo.ts), and the wiring that puts it on every page.
// Node strips the file's types; it imports nothing at runtime, so it runs here as it runs in Next.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(ROOT, 'site', 'src', 'app');
const SITE = 'https://tekjobs.example';

test('a page gets its title, description, canonical path and a share card with the full title and the image', () => {
  const m = pageMeta({ title: 'Scoring and criteria', description: 'How a score is built.', path: '/docs/scoring', type: 'article' });
  assert.equal(m.title, 'Scoring and criteria');
  assert.equal(m.description, 'How a score is built.');
  assert.deepEqual(m.alternates, { canonical: '/docs/scoring' });
  assert.equal(m.openGraph.title, 'Scoring and criteria · TekJobs');
  assert.equal(m.openGraph.url, '/docs/scoring');
  assert.equal(m.openGraph.type, 'article');
  assert.equal(m.openGraph.siteName, SITE_NAME);
  assert.deepEqual(m.openGraph.images, [SOCIAL_IMAGE]);
  assert.equal(m.twitter.title, 'Scoring and criteria · TekJobs');
  assert.equal(m.twitter.card, 'summary_large_image');
});

test('a title that already names the site is used as it is, not templated twice', () => {
  const m = pageMeta({ title: 'TekJobs: a job search', description: 'd', path: '/' });
  assert.deepEqual(m.title, { absolute: 'TekJobs: a job search' });
  assert.equal(m.openGraph.title, 'TekJobs: a job search');
});

test('extra Open Graph fields are added without losing the image', () => {
  const m = pageMeta({ title: 'T', description: 'd', path: '/', openGraph: { videos: [{ url: 'https://x/v.mp4' }] } });
  assert.deepEqual(m.openGraph.videos, [{ url: 'https://x/v.mp4' }]);
  assert.deepEqual(m.openGraph.images, [SOCIAL_IMAGE]);
});

test('private pages are noindex, nofollow', () => {
  assert.deepEqual(PRIVATE.robots, { index: false, follow: false });
});

test('robots.txt lets crawlers read the site, keeps them out of the API and the signed-in app, and names the sitemap', () => {
  const r = robotsFor(SITE);
  assert.deepEqual(r.rules, [{ userAgent: '*', allow: '/', disallow: ['/api/', '/app/'] }]);
  assert.equal(r.sitemap, `${SITE}/sitemap.xml`);
  assert.equal(r.host, 'tekjobs.example');
});

test('the sitemap lists every public page with absolute URLs, and leaves out the redirecting indexes', () => {
  const s = sitemapFor(SITE, {
    docs: [{ slug: 'getting-started', updated: '' }, { slug: 'scoring' }],
    legal: [{ slug: 'terms', updated: '2026-10-01' }, { slug: 'privacy', updated: 'not a date' }],
    jobs: [{ id: 'abc', publishedAt: '2026-10-10T00:00:00.000Z' }, { id: 'def', publishedAt: '2026-10-09T00:00:00.000Z', updatedAt: '2026-10-12T00:00:00.000Z' }],
  });
  assert.deepEqual(s.map((e) => e.url), [
    `${SITE}/`, `${SITE}/jobs`, `${SITE}/post-a-job`,
    `${SITE}/docs/getting-started`, `${SITE}/docs/scoring`,
    `${SITE}/legal/terms`, `${SITE}/legal/privacy`,
    `${SITE}/jobs/abc`, `${SITE}/jobs/def`,
  ]);
  const by = Object.fromEntries(s.map((e) => [e.url, e]));
  assert.equal(by[`${SITE}/legal/terms`].lastModified.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal('lastModified' in by[`${SITE}/legal/privacy`], false, 'an unparseable date is left out');
  assert.equal('lastModified' in by[`${SITE}/docs/getting-started`], false);
  assert.equal(by[`${SITE}/jobs/def`].lastModified.toISOString(), '2026-10-12T00:00:00.000Z');
  assert.ok(!s.some((e) => /\/(docs|legal)$/.test(e.url)));
});

test('the sitemap with no docs, no legal pages and no live jobs still has the three fixed pages', () => {
  assert.equal(sitemapFor(SITE, { docs: [], legal: [], jobs: [] }).length, 3);
});

test('JSON-LD cannot close its script tag, and still parses to the same data', () => {
  const data = { description: 'Fun role </script><script>alert(1)</script>' };
  const out = jsonLd(data);
  assert.ok(!out.includes('<'), out);
  assert.deepEqual(JSON.parse(out), data);
});

test('the home graph names the publisher, the website and the software, linked by id', () => {
  const g = homeLd({ siteUrl: SITE, repo: 'https://github.com/Timurtek/tekjobs', npm: 'https://www.npmjs.com/package/@timurtekb/tekjobs', author: 'https://www.timurtek.com' });
  assert.equal(g['@context'], 'https://schema.org');
  const [org, site, app] = g['@graph'];
  assert.deepEqual([org['@type'], site['@type'], app['@type']], ['Organization', 'WebSite', 'SoftwareApplication']);
  assert.equal(site.url, `${SITE}/`);
  assert.equal(site.publisher['@id'], org['@id']);
  assert.equal(app.publisher['@id'], org['@id']);
  assert.equal(app.offers.price, '0');
  assert.equal(app.image, `${SITE}${SOCIAL_IMAGE.url}`);
  assert.ok(app.sameAs.includes('https://github.com/Timurtek/tekjobs'));
  assert.ok(app.applicationCategory && app.operatingSystem, 'Google requires both for a SoftwareApplication');
});

test('a docs page is a TechArticle with an absolute URL, part of the site', () => {
  const a = articleLd({ siteUrl: SITE, path: '/docs/mcp', title: 'MCP', description: 'Tools over MCP.', author: 'https://www.timurtek.com' });
  assert.equal(a['@type'], 'TechArticle');
  assert.equal(a.headline, 'MCP');
  assert.equal(a.url, `${SITE}/docs/mcp`);
  assert.equal(a.isPartOf['@id'], `${SITE}/#website`);
});

// The wiring. Every page under site/src/app either sets its metadata with pageMeta (a public page, with a
// canonical), is marked PRIVATE (noindex), or only redirects. A new page that does none of these fails here.
test('every page is public with pageMeta, private with PRIVATE, or a redirect', () => {
  const pages = [];
  const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.name === 'page.tsx') pages.push(p); } };
  walk(APP);
  assert.ok(pages.length >= 12, `found only ${pages.length} pages`);
  const kind = {};
  for (const p of pages) {
    const src = fs.readFileSync(p, 'utf8');
    const rel = path.relative(APP, p).replaceAll('\\', '/');
    const isPublic = /pageMeta\(/.test(src);
    const isPrivate = /\.\.\.PRIVATE/.test(src);
    const isRedirect = /^\s*redirect\("[^"]+"\);\s*$/m.test(src) && !/<section/.test(src);
    assert.equal([isPublic, isPrivate, isRedirect].filter(Boolean).length, 1, `${rel}: public ${isPublic}, private ${isPrivate}, redirect ${isRedirect}`);
    kind[rel] = isPublic ? 'public' : isPrivate ? 'private' : 'redirect';
  }
  assert.deepEqual(kind, {
    'account/page.tsx': 'private',
    'app/post-a-job/[id]/page.tsx': 'private',
    'app/post-a-job/new/page.tsx': 'private',
    'app/post-a-job/page.tsx': 'private',
    'docs/[slug]/page.tsx': 'public',
    'docs/page.tsx': 'redirect',
    'jobs/[id]/page.tsx': 'public',
    'jobs/page.tsx': 'public',
    'legal/[slug]/page.tsx': 'public',
    'legal/page.tsx': 'redirect',
    'login/page.tsx': 'private',
    'page.tsx': 'public',
    'post-a-job/page.tsx': 'public',
  });
});

test('the site serves robots.txt and sitemap.xml from seo.ts, and puts JSON-LD on the home, docs and job pages', () => {
  const app = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8');
  assert.match(app('robots.ts'), /return robotsFor\(appUrl\)/);
  assert.match(app('sitemap.ts'), /sitemapFor\(appUrl, \{ docs: allDocs\(\), legal: allLegal\(\), jobs \}\)/);
  assert.match(app('page.tsx'), /application\/ld\+json[^\n]*jsonLd\(homeLd\(/);
  assert.match(app('docs/[slug]/page.tsx'), /application\/ld\+json[^\n]*jsonLd\(articleLd\(/);
  assert.match(app('jobs/[id]/page.tsx'), /application\/ld\+json[^\n]*jsonLd\(posting\)/);
  // No page writes raw JSON.stringify into a script tag.
  for (const rel of ['page.tsx', 'docs/[slug]/page.tsx', 'jobs/[id]/page.tsx']) assert.doesNotMatch(app(rel), /__html: JSON\.stringify/, rel);
});
