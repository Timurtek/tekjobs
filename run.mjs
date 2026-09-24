#!/usr/bin/env node
// TekJobs runner. Usage: node run.mjs [--dry] [--min N] [--floor N] [--only slug] [--retry-failed] [--criteria <preset name | file>] [--no-remoteok] [--no-hn] [--check-slugs]
import fs from 'node:fs';
import path from 'node:path';
import { ensureDirs, loadCriteria, loadCompanies, writeCompanyStatuses, criteriaPresetFile, P } from './scraper/config.mjs';
import { fetchCompany, fetchRemoteOK, fetchHNWhoIsHiring, htmlToText } from './scraper/sources.mjs';
import { scoreJob, parseSalary } from './scraper/score.mjs';
import { loadSeen, saveSeen, writeJobNote, markClosedListings, appendLog, writeDashboard, readFrontmatter } from './scraper/vault.mjs';
import { weightsFingerprint } from './scraper/rescore.mjs';
import { loadHealth, saveHealth, record, healthState } from './scraper/health.mjs';

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const DRY = flag('--dry');
const ONLY = opt('--only');
// Only the boards whose latest attempt failed, and no feeds: the Sources page's Retry button.
const RETRY = flag('--retry-failed');

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

const t0 = Date.now();
ensureDirs();
// Which criteria this run scores with: the active note, or a named preset / any criteria file for this run only.
let criteriaFile = P.criteria, criteriaName = 'Search Criteria';
if (opt('--criteria')) {
  const want = opt('--criteria');
  criteriaFile = fs.existsSync(want) ? path.resolve(want) : criteriaPresetFile(want);
  if (!fs.existsSync(criteriaFile)) { console.error(`No criteria preset or file "${want}" (looked in ${P.criteriaDir}).`); process.exit(1); }
  criteriaName = path.basename(criteriaFile, '.md');
}
const criteria = loadCriteria(criteriaFile);
const criteriaLabel = `${criteriaName} (${weightsFingerprint(criteria)})`;
if (opt('--min')) criteria.minScore = Number(opt('--min'));
if (opt('--floor')) { criteria.salary = { ...(criteria.salary || {}), minAnnual: Number(opt('--floor')) }; console.log(`  pay floor overridden: $${criteria.salary.minAnnual}`); }
let companies = loadCompanies();
if (ONLY) companies = companies.filter((c) => c.slug === ONLY || c.name.toLowerCase() === ONLY.toLowerCase());
const health = loadHealth();
if (RETRY) {
  companies = companies.filter((c) => healthState(health.boards[`${c.ats}:${c.slug}`], c.status) === 'failed');
  if (companies.length === 0) { console.log('No failed boards to retry.'); process.exit(0); }
}
console.log(`TekJobs run ${new Date().toISOString()}${DRY ? ' (dry)' : ''} — ${companies.length} companies, minScore ${criteria.minScore}, criteria ${criteriaLabel}`);

// 1. Fetch company boards
const statusBySlug = {};
const liveIdsByCompanyKey = {};
const failed = [];
// Workday boards are slow (search + per-job detail); run them last so the fast boards finish first.
companies.sort((a, b) => (a.ats === 'workday') - (b.ats === 'workday'));
const results = await pool(companies, 8, async (c) => {
  const key = `${c.ats}:${c.slug}`;
  const r = await fetchCompany(c, criteria);
  health.boards[key] = record(health.boards[key], r);
  if (!r.ok) {
    statusBySlug[key] = `bad-slug (${r.error})`;
    failed.push({ ...c, error: r.error });
    process.stdout.write(`  x ${c.name} [${key}] ${r.error}\n`);
    return [];
  }
  statusBySlug[key] = r.emptyBoard ? 'ok · 0 jobs (slug?)' : r.scanned != null ? `ok · ${r.jobs.length} of ${r.scanned} searched` : `ok · ${r.jobs.length}`;
  liveIdsByCompanyKey[key] = new Set(r.jobs.map((j) => j.id));
  for (const j of r.jobs) { j.companyKey = key; j.tier = c.tier; }
  return r.jobs;
});
let jobs = results.flat();

// 2. Open sources (no slug). RemoteOK and HN are always on unless flagged; the rest toggle via criteria.openSources.
const extras = [];
const open = criteria.openSources || {};
if (!ONLY && !RETRY) {
  const { OPEN_SOURCES } = await import('./scraper/sources-extra.mjs');
  const tasks = [];
  if (!flag('--no-remoteok') && open.remoteok !== false) tasks.push(['RemoteOK', fetchRemoteOK]);
  if (!flag('--no-hn') && open.hn !== false) tasks.push(['HN Who is hiring', fetchHNWhoIsHiring]);
  // A source marked defaultOn (TekJobs' own postings) runs unless the criteria say `false`; the rest are opt-in.
  for (const [key, def] of Object.entries(OPEN_SOURCES)) if (def.defaultOn ? open[key] !== false : open[key]) tasks.push([def.label, def.fn]);
  // Open-source fetchers are handed the criteria. Most ignore it; the ones that read the profile (Adzuna
  // searches for its own titleTerms) need it, and the rest destructure their own options, so an extra
  // argument is harmless.
  // The inbox folder is a path, not a preference, so it is passed alongside the criteria rather than
  // written into a file the person edits by hand.
  const withPaths = { ...criteria, _inbox: P.inbox };
  const results = await pool(tasks, 4, async ([label, fn]) => [label, await fn(withPaths)]);
  for (const [label, r] of results) {
    extras.push([label, r]);
    health.feeds[label] = record(health.feeds[label], r);
    if (r.ok) { for (const j of r.jobs) j.companyKey = `open:${label}`; jobs.push(...r.jobs); liveIdsByCompanyKey[`open:${label}`] = new Set(r.jobs.map((j) => j.id)); }
    else console.log(`  x ${label} ${r.error}`);
  }
}
if (flag('--check-slugs')) {
  console.table(Object.entries(statusBySlug).map(([k, v]) => ({ board: k, status: v })));
  if (!DRY) writeCompanyStatuses(statusBySlug);
  process.exit(0);
}

// 2b. Dedupe. The same opening shows up per-location on some boards (Rippling, Greenhouse multi-city) and again on
// aggregators. Key on company + title; keep the ATS copy over the aggregator copy; merge locations of the rest.
// Sources whose copy of a posting is thinner than the ATS's, and so loses when both are present: the
// aggregators, Adzuna (snippet descriptions) and anything imported from an alert email (a title and
// little else). USAJOBS is not one of them — it is the authority for the jobs it carries.
const AGG = new Set(['themuse', 'remotive', 'himalayas', 'jobicy', 'workingnomads', 'arbeitnow', 'wwr', 'remoteok', 'hn', 'adzuna', 'wellfound', 'builtin']);
const isThin = (j) => AGG.has(j.source) || String(j.source).startsWith('email:');
{
  const norm = (s) => (s || '').toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const byKey = new Map();
  const ordered = [...jobs].sort((a, b) => (isThin(a) - isThin(b)));
  for (const j of ordered) {
    const key = `${norm(j.company)}|${norm(j.title)}`;
    const keep = byKey.get(key);
    if (!keep) { byKey.set(key, j); continue; }
    if (keep.source === j.source && j.location && !keep.location.includes(j.location)) keep.location = `${keep.location}; ${j.location}`.slice(0, 300);
    if (!keep.salary && j.salary) { keep.salary = j.salary; }
    if (!keep.remote && j.remote) keep.remote = true;
    keep.dupes = (keep.dupes || 0) + 1;
    // Some boards repeat the same posting id once per location; never drop the id the kept note points at.
    if (j.id !== keep.id && j.companyKey && liveIdsByCompanyKey[j.companyKey]) liveIdsByCompanyKey[j.companyKey].delete(j.id);
  }
  const before = jobs.length;
  jobs = [...byKey.values()];
  console.log(`  dedupe: ${before} → ${jobs.length}`);
}

// 3. Score
for (const j of jobs) {
  j.descriptionText = htmlToText(j.descriptionHtml || '');
  const range = parseSalary(`${j.salary || ''}\n${j.descriptionText}`);
  if (range) { j.salaryMin = range.min; j.salaryMax = range.max; if (!j.salary) j.salary = `$${Math.round(range.min / 1000)}k–$${Math.round(range.max / 1000)}k`; }
  j.scored = scoreJob(j, criteria);
}
const scored = jobs.filter((j) => !j.scored.excluded).sort((a, b) => b.scored.score - a.scored.score);
const matches = scored.filter((j) => j.scored.score >= criteria.minScore);

// 4. Write new matches to the vault
const seen = loadSeen();
const fresh = matches.filter((j) => !seen[j.id]);
const written = [];
for (const j of fresh) {
  if (DRY) { written.push({ job: j, file: '(dry)' }); continue; }
  const file = writeJobNote(j, j.scored, criteria);
  seen[j.id] = { path: file, firstSeen: new Date().toISOString(), company: j.company, title: j.title, companyKey: j.companyKey || j.source, score: j.scored.score };
  written.push({ job: j, file });
}
let closed = [];
if (!DRY) {
  closed = markClosedListings(liveIdsByCompanyKey, seen);
  saveSeen(seen);
  writeCompanyStatuses(statusBySlug);
}

// Source health is diagnostic, so it is written on dry runs too.
saveHealth(health);

// 5. Debug snapshot: everything scored, so near-misses can be reviewed and criteria tuned
fs.writeFileSync(P.lastRun, JSON.stringify({
  when: new Date().toISOString(), minScore: criteria.minScore, failed,
  jobs: scored.slice(0, 800).map((j) => ({ score: j.scored.score, company: j.company, title: j.title, location: j.location, remote: !!j.remote, salary: j.salary || '', salaryMin: j.salaryMin || null, salaryMax: j.salaryMax || null, payBand: j.scored.payBand, posted: j.posted, url: j.url, source: j.source, reasons: j.scored.reasons, isNew: !seen[j.id] || fresh.includes(j) })),
}, null, 2));

// 6. Log + dashboard
const summary = {
  when: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
  companiesTotal: companies.length,
  companiesOk: companies.length - failed.length,
  companiesFailed: failed.length,
  totalJobs: jobs.length,
  newMatches: written.length,
};
const logLines = [
  `## Run ${summary.when}${DRY ? ' (dry)' : ''}`,
  `- Boards: ${summary.companiesOk}/${summary.companiesTotal} ok · postings scanned: ${summary.totalJobs} · scored ≥ ${criteria.minScore}: ${matches.length} · **new: ${written.length}** · closed: ${closed.length} · ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  `- Criteria: ${criteriaLabel}`,
  // Who started it: the morning task (run.cmd / run.sh), the app, an agent over MCP, or someone at the CLI.
  `- Via: ${process.env.TEKJOBS_RUN_VIA || 'cli'}`,
  ...extras.map(([n, r]) => `- ${n}: ${r.ok ? `${r.jobs.length} postings${r.thread ? ` (${r.thread})` : ''}` : `failed: ${r.error}`}`),
  ...(failed.length ? [`- Failed slugs: ${failed.map((f) => `${f.name} (${f.ats}:${f.slug} — ${f.error})`).join('; ')}`] : []),
  ...(written.length ? ['', '### New matches', ...written.map(({ job }) => `- **${job.scored.score}** ${job.company} — [${job.title}](${job.url}) · ${job.location || 'n/a'}`)] : []),
  ...(closed.length ? ['', '### Closed since last run', ...closed.map((c) => `- ${c.company} — ${c.title}`)] : []),
];
if (!DRY) {
  appendLog(logLines);
  writeDashboard(summary);
}
console.log(logLines.join('\n'));
// The top of the list, with where each one stands. Ranking ignores status on purpose (the score is about the
// posting), but a person reading the log should not be shown a job they already applied to as if it were news.
const statusOf = (j) => { const p = seen[j.id]?.path; if (!p) return 'new'; const fm = readFrontmatter(p); return fm?.status || 'new'; };
const top = scored.map((j) => ({ j, status: statusOf(j) }));
const stillOpen = top.filter((t) => !['applied', 'interviewing', 'offer', 'rejected', 'passed'].includes(t.status));
console.log(`\nTop 15 still open (not yet applied or passed):`);
for (const { j, status } of stillOpen.slice(0, 15)) console.log(`  ${String(j.scored.score).padStart(4)}  ${status === 'new' ? '' : `[${status}] `}${j.company} — ${j.title}  [${j.location}]`);
const done = top.slice(0, 30).filter((t) => ['applied', 'interviewing', 'offer', 'passed', 'rejected'].includes(t.status));
if (done.length) console.log(`  (${done.length} of the top 30 already ${done.map((t) => t.status).filter((s, i, a) => a.indexOf(s) === i).join('/')}: ${done.map((t) => t.j.company).join(', ')})`);
