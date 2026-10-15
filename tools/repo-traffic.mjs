// How many people reach TekJobs through the repo, read from GitHub's counters, never from the software: TekJobs
// promises "There is no telemetry" (README), so its usage is counted where it is published.
// `npm run traffic` prints a markdown note; `--json` prints the same numbers as JSON. docs/analytics.md says what
// each number proves.
//
// The counters are the four Tek named (2026-10-13): stars, forks, clones and release downloads. Stars, forks and
// release downloads are public and need no key. Clones come from GitHub's traffic API, which needs a token with
// push access to the repo: set GITHUB_TOKEN and they are read; without it they are reported as not read, and
// everything else still is.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = 'Timurtek/tekjobs';
// Overridable so the tests can stand in a local server for GitHub.
const GITHUB_API = process.env.TEKJOBS_GITHUB_API || 'https://api.github.com';

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'tekjobs-repo-traffic', ...headers } });
  if (!res.ok) throw new Error(`${url} answered ${res.status} ${res.statusText}`);
  try {
    return await res.json();
  } catch {
    throw new Error(`${url} answered something that is not JSON`);
  }
}

// GitHub's answers are checked before they are counted, so a changed or broken API fails the run by name
// instead of printing a wrong number.
function count(value, url, field) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${url} gave ${field} = ${JSON.stringify(value)}, not a count`);
  return value;
}
function object(value, url) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${url} did not answer with an object`);
  return value;
}

/** Every counter, read now. A counter that cannot be read is null, and `notes` says why. */
export async function repoTraffic({ token = process.env.GITHUB_TOKEN, now = new Date() } = {}) {
  const url = (p) => `${GITHUB_API}/repos/${REPO}${p}`;
  const gh = (p, auth) => getJson(url(p), auth ? { authorization: `Bearer ${token}` } : {});
  const notes = [];

  const repo = object(await gh(''), url(''));
  const stars = count(repo.stargazers_count, url(''), 'stargazers_count');
  const forks = count(repo.forks_count, url(''), 'forks_count');

  // Every page: the repo releases often, and one page of 100 would undercount within weeks.
  let releases = 0;
  let releaseDownloads = 0;
  for (let page = 1; ; page++) {
    const p = `/releases?per_page=100&page=${page}`;
    const batch = await gh(p);
    if (!Array.isArray(batch)) throw new Error(`${url(p)} did not answer with a list of releases`);
    for (const [i, r] of batch.entries()) {
      // GitHub always sends `assets`, empty when a release has none, so a missing list is a broken answer, not zero.
      const assets = object(r, url(p)).assets;
      if (!Array.isArray(assets)) throw new Error(`${url(p)} gave release ${i} assets = ${JSON.stringify(assets)}, not a list`);
      for (const [j, a] of assets.entries()) {
        releaseDownloads += count(object(a, url(p)).download_count, url(p), `release ${i} asset ${j} download_count`);
      }
    }
    releases += batch.length;
    if (batch.length < 100) break;
  }

  let clones = null;
  if (token) {
    const c = object(await gh('/traffic/clones', true), url('/traffic/clones'));
    clones = { count: count(c.count, url('/traffic/clones'), 'count'), uniques: count(c.uniques, url('/traffic/clones'), 'uniques') };
  } else {
    notes.push('Clones not read: set GITHUB_TOKEN to a token with push access to the repo.');
  }

  return {
    read: now.toISOString(),
    repo: REPO,
    stars,
    forks,
    releases,
    release_downloads: releaseDownloads,
    clones_14d: clones,
    notes,
  };
}

/** The numbers as a vault note: frontmatter for anything that reads fields, a table for a person. */
export function toNote(t) {
  const fields = {
    type: 'metric', source: 'tekjobs repo-traffic', read: t.read, repo: t.repo,
    stars: t.stars, forks: t.forks, releases: t.releases, release_downloads: t.release_downloads,
    clones_14d: t.clones_14d ? t.clones_14d.count : 'null', clones_14d_unique: t.clones_14d ? t.clones_14d.uniques : 'null',
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
    `| GitHub releases | ${t.releases} |`,
    `| Release asset downloads | ${t.release_downloads} |`,
    `| Clones, last 14 days | ${t.clones_14d ? `${t.clones_14d.count} (${t.clones_14d.uniques} unique)` : 'not read'} |`,
    '',
    ...t.notes.map((n) => `- ${n}`),
    'What each number proves: docs/analytics.md in the tekjobs repo.',
    '',
  ].join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const t = await repoTraffic();
    process.stdout.write(process.argv.includes('--json') ? JSON.stringify(t, null, 2) + '\n' : toNote(t));
  } catch (e) {
    console.error(`Could not read the repo traffic: ${e.message}`);
    process.exit(1);
  }
}
