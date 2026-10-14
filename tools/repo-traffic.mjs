// How many people reach TekJobs through the repo and the package, read from public counters, never from the
// software: TekJobs promises "There is no telemetry" (README), so its usage is counted where it is published.
// `npm run traffic` prints a markdown note; `--json` prints the same numbers as JSON; `--out <file>` writes the
// output to a file as well. docs/analytics.md says what each number proves.
//
// Stars, forks, watchers, release downloads and npm downloads are public and need no key. Clones and views come
// from GitHub's traffic API, which needs a token with push access to the repo: set GITHUB_TOKEN and they are
// read; without it they are reported as not read, and everything else still is.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = 'Timurtek/tekjobs';
export const PACKAGE = '@timurtekb/tekjobs';
// Overridable so the tests can stand in a local server for both APIs.
const GITHUB_API = process.env.TEKJOBS_GITHUB_API || 'https://api.github.com';
const NPM_API = process.env.TEKJOBS_NPM_API || 'https://api.npmjs.org';

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'tekjobs-repo-traffic', ...headers } });
  if (!res.ok) throw new Error(`${url} answered ${res.status} ${res.statusText}`);
  return res.json();
}

/** Every counter, read now. A counter that cannot be read is null, and `notes` says why. */
export async function repoTraffic({ token = process.env.GITHUB_TOKEN, now = new Date() } = {}) {
  const gh = (p, auth) => getJson(`${GITHUB_API}/repos/${REPO}${p}`, auth ? { authorization: `Bearer ${token}` } : {});
  const notes = [];

  const repo = await gh('');
  // Every page: the repo releases often, and one page of 100 would undercount within weeks.
  const releases = [];
  for (let page = 1; ; page++) {
    const batch = await gh(`/releases?per_page=100&page=${page}`);
    releases.push(...batch);
    if (batch.length < 100) break;
  }
  const releaseDownloads = releases.reduce((sum, r) => sum + (r.assets || []).reduce((s, a) => s + (a.download_count || 0), 0), 0);

  let clones = null;
  let views = null;
  if (token) {
    const c = await gh('/traffic/clones', true);
    const v = await gh('/traffic/views', true);
    clones = { count: c.count, uniques: c.uniques };
    views = { count: v.count, uniques: v.uniques };
  } else {
    notes.push('Clones and views not read: set GITHUB_TOKEN to a token with push access to the repo.');
  }

  const pkg = encodeURIComponent(PACKAGE);
  const week = await getJson(`${NPM_API}/downloads/point/last-week/${pkg}`);
  const month = await getJson(`${NPM_API}/downloads/point/last-month/${pkg}`);

  return {
    read: now.toISOString(),
    repo: REPO,
    package: PACKAGE,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    watchers: repo.subscribers_count,
    releases: releases.length,
    release_downloads: releaseDownloads,
    clones_14d: clones,
    views_14d: views,
    npm_downloads_week: week.downloads,
    npm_downloads_month: month.downloads,
    notes,
  };
}

const pair = (x) => (x ? `${x.count} (${x.uniques} unique)` : 'not read');

/** The numbers as a vault note: frontmatter for anything that reads fields, a table for a person. */
export function toNote(t) {
  const fields = {
    type: 'metric', source: 'tekjobs repo-traffic', read: t.read, repo: t.repo, package: t.package,
    stars: t.stars, forks: t.forks, watchers: t.watchers, releases: t.releases, release_downloads: t.release_downloads,
    clones_14d: t.clones_14d ? t.clones_14d.count : 'null', clones_14d_unique: t.clones_14d ? t.clones_14d.uniques : 'null',
    views_14d: t.views_14d ? t.views_14d.count : 'null', views_14d_unique: t.views_14d ? t.views_14d.uniques : 'null',
    npm_downloads_week: t.npm_downloads_week, npm_downloads_month: t.npm_downloads_month,
  };
  return [
    '---',
    ...Object.entries(fields).map(([k, v]) => `${k}: ${typeof v === 'string' && v !== 'null' ? JSON.stringify(v) : v}`),
    '---',
    '',
    `# TekJobs repo traffic, ${t.read.slice(0, 10)}`,
    '',
    '| counter | value |',
    '| --- | --- |',
    `| GitHub stars | ${t.stars} |`,
    `| GitHub forks | ${t.forks} |`,
    `| GitHub watchers | ${t.watchers} |`,
    `| GitHub releases | ${t.releases} |`,
    `| Release asset downloads | ${t.release_downloads} |`,
    `| Clones, last 14 days | ${pair(t.clones_14d)} |`,
    `| Views, last 14 days | ${pair(t.views_14d)} |`,
    `| npm downloads, last week | ${t.npm_downloads_week} |`,
    `| npm downloads, last month | ${t.npm_downloads_month} |`,
    '',
    ...t.notes.map((n) => `- ${n}`),
    'What each number proves: docs/analytics.md in the tekjobs repo.',
    '',
  ].join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const outAt = args.indexOf('--out');
  const out = outAt >= 0 ? args[outAt + 1] : '';
  if (outAt >= 0 && !out) {
    console.error('--out needs a file path, for example: npm run traffic -- --out "TekJobs repo traffic.md"');
    process.exit(2);
  }
  try {
    const t = await repoTraffic();
    const text = args.includes('--json') ? JSON.stringify(t, null, 2) + '\n' : toNote(t);
    if (out) {
      fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
      fs.writeFileSync(out, text);
    }
    process.stdout.write(text);
  } catch (e) {
    console.error(`Could not read the repo traffic: ${e.message}`);
    process.exit(1);
  }
}
