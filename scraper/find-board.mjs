// Where did a board go? A company that answers 404 on the platform the watchlist names has usually moved its
// careers page to another tracker, often keeping the same slug (Amplitude, Hightouch and Outschool all went
// from Greenhouse to Ashby). This asks every platform the scan can read, with the same slug, and reports the
// ones that answer with jobs; `moveCompany` rewrites the row when the person says so.
import fs from 'node:fs';
import { P, loadCompanies } from './config.mjs';
import { fetchCompany } from './sources.mjs';

/** Platforms a slug alone identifies. Workday needs host/tenant/site; the career APIs are not per-company boards. */
export const PROBE_ATS = ['greenhouse', 'ashby', 'lever', 'workable', 'smartrecruiters', 'rippling', 'bamboohr', 'breezy', 'personio', 'teamtailor', 'eightfold'];
const ANY_TITLE = { titleTerms: {}, titleExclude: [] };

/**
 * Every platform that answers for this slug, best first (most jobs). `except` is the platform that already
 * failed, left out. `fetch` is the board fetcher, injectable so a test needs no network.
 */
export async function probeBoard(slug, { name = slug, except = '', fetch = fetchCompany, platforms = PROBE_ATS } = {}) {
  const tried = platforms.filter((p) => p !== except);
  const results = await Promise.all(tried.map(async (ats) => {
    try {
      const r = await fetch({ name, ats, slug }, ANY_TITLE);
      return { ats, ok: !!r.ok, jobs: r.ok ? (r.jobs || []).length : 0, error: r.ok ? '' : String(r.error || '') };
    } catch (e) { return { ats, ok: false, jobs: 0, error: e.message }; }
  }));
  const found = results.filter((r) => r.ok && r.jobs > 0).sort((a, b) => b.jobs - a.jobs);
  return { slug, except, tried, found, note: found.length ? `Answers on ${found.map((f) => `${f.ats} (${f.jobs} job${f.jobs === 1 ? '' : 's'})`).join(', ')}.` : `No platform answers for "${slug}". The company may have renamed its board; look at its careers page for the new slug.` };
}

/** Rewrite one watchlist row's platform in place; the status cell is cleared for the scan, the move is noted. */
export function moveCompany({ name, slug, from, to }, { today = new Date().toISOString().slice(0, 10) } = {}) {
  if (!slug || !to) throw Object.assign(new Error('slug and to are required'), { status: 400 });
  const row = loadCompanies().find((c) => c.slug === slug && (!from || c.ats === from) && (!name || c.name === name));
  if (!row) throw Object.assign(new Error(`No row for ${from ? from + ':' : ''}${slug} on the watchlist`), { status: 404 });
  if (row.ats === to) return { moved: false, row };
  const md = fs.readFileSync(P.companies, 'utf8');
  let moved = false;
  const out = md.split(/\r?\n/).map((line) => {
    if (moved || !line.trim().startsWith('|')) return line;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 3 || cells[0] !== row.name || cells[1].toLowerCase() !== row.ats || cells[2] !== row.slug) return line;
    while (cells.length < 6) cells.push('');
    cells[1] = to;
    cells[4] = '';
    cells[5] = [cells[5], `moved from ${row.ats} ${today}`].filter(Boolean).join('; ');
    moved = true;
    return `| ${cells.join(' | ')} |`;
  });
  if (!moved) throw Object.assign(new Error(`Could not find the row for ${row.name} in ${P.companies}`), { status: 500 });
  fs.writeFileSync(P.companies, out.join('\n'));
  return { moved: true, row: { ...row, ats: to, status: '', notes: [row.notes, `moved from ${row.ats} ${today}`].filter(Boolean).join('; ') } };
}
