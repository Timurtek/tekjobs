// The LinkedIn import: reads the export in place (scraper/linkedin.mjs) and writes only into the profile folder:
// the index the app answers "who do I know there" from, and People notes for the recruiters and hiring managers
// who wrote lately. Re-running is safe: people are recognised, not duplicated; log lines already present are not
// appended again.
import fs from 'node:fs';
import path from 'node:path';
import { P, DATA_DIR } from '../../scraper/config.mjs';
import { readExport, buildIndex, peopleCandidates, warmPaths, companyKey } from '../../scraper/linkedin.mjs';
import * as people from './people.mjs';
import * as store from './store.mjs';

const isoDay = (d = new Date()) => d.toISOString().slice(0, 10);
const daysAgo = (n) => isoDay(new Date(Date.now() - n * 864e5));

// ---------- the index ----------
let cached = { mtime: 0, index: null };
/** The last import's index, or null before the first import. Re-read when the file changes. */
export function loadIndex() {
  try {
    const mtime = fs.statSync(P.linkedin).mtimeMs;
    if (mtime !== cached.mtime) cached = { mtime, index: JSON.parse(fs.readFileSync(P.linkedin, 'utf8')) };
    return cached.index;
  } catch { return null; }
}

/** Who you know at a company, from the index; an empty answer before any import. */
export function connectionsAt(company) {
  const index = loadIndex();
  if (!index) return { company, count: 0, people: [], imported: null };
  return { ...warmPaths(index, company), imported: index.built };
}

/** What the last import left behind, for the People page: when, from what, and the counts. */
export function status() {
  const index = loadIndex();
  if (!index) return { imported: null };
  return { imported: index.built, since: index.since, source: index.source, counts: index.counts, self: index.self };
}

// ---------- choosing ----------
/** The candidates an import writes as People by default: the ones whose title says recruiter or hiring manager. */
function chosen(candidates, { roles, everyone }) {
  return candidates.filter((c) => everyone ? c.count > 0 : roles.includes(c.role));
}

/** Everything an import would do, without doing it. */
export function preview(source, { since = daysAgo(90), roles = ['recruiter', 'hiring-manager'], everyone = false } = {}) {
  const ex = readExport(source);
  const index = buildIndex(ex, { since });
  const candidates = peopleCandidates(index, { since });
  const picked = chosen(candidates, { roles, everyone });
  const jobs = store.listJobs();
  const jobKeys = new Map(jobs.map((j) => [companyKey(j.company), j]));
  const withNotes = picked.filter((c) => c.company && jobKeys.has(companyKey(c.company)));
  const seenCompany = new Set();
  const knownAt = jobs.filter((j) => { const k = companyKey(j.company); return k && !seenCompany.has(k) && seenCompany.add(k); }).map((j) => ({ company: j.company, count: warmPaths(index, j.company).count })).filter((j) => j.count > 0).sort((a, b) => b.count - a.count);
  return {
    source: ex.source, kind: ex.kind, files: ex.files, since, self: index.self, counts: index.counts,
    people: { candidates: candidates.length, chosen: picked.length, onJobNotes: withNotes.length, sample: picked.slice(0, 12).map((c) => ({ name: c.name, role: c.role, company: c.company, title: c.title, last: c.last, messages: c.count })) },
    warmPaths: { jobsWithConnections: knownAt.length, top: knownAt.slice(0, 10) },
    applicationsSince: index.applications.filter((a) => a.date >= since).length,
    savedJobsSince: index.savedJobs.filter((s) => s.date >= since).length,
  };
}

// ---------- writing ----------
/**
 * Run the import. Writes the index, then (unless told not to) People notes with their LinkedIn log and a link to
 * any open job note at their company. `dry` does everything but write.
 */
export function runImport(source, { since = daysAgo(90), roles = ['recruiter', 'hiring-manager'], everyone = false, writePeople = true, dry = false } = {}) {
  const ex = readExport(source);
  const index = buildIndex(ex, { since });
  const summary = { source: ex.source, since, self: index.self, counts: index.counts, dry, indexPath: P.linkedin, people: { created: 0, recognised: 0, attached: 0, skipped: 0, logged: 0 } };

  if (!dry) { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(P.linkedin, JSON.stringify(index, null, 1)); cached = { mtime: 0, index: null }; }

  if (writePeople) {
    const candidates = peopleCandidates(index, { since });
    const picked = chosen(candidates, { roles, everyone });
    summary.people.skipped = candidates.length - picked.length;
    const jobs = store.listJobs().filter((j) => j.status !== 'closed' && j.status !== 'rejected' && j.status !== 'passed');
    for (const c of picked) {
      if (dry) { summary.people.created++; continue; }
      const before = people.findPerson({ name: c.name, company: c.company });
      const person = people.createPerson({ name: c.name, role: c.role, company: c.company, links: c.url, about: `${c.title ? c.title + (c.company ? ` at ${c.company}` : '') + '. ' : ''}From the LinkedIn import: ${c.count} message${c.count === 1 ? '' : 's'} between ${c.first} and ${c.last}.` });
      summary.people[before ? 'recognised' : 'created']++;
      const text = fs.readFileSync(person.path, 'utf8');
      for (const l of c.log) {
        const line = `- ${l.date} (${l.via}): ${l.text}`;
        if (text.includes(line.slice(0, 80))) continue;
        people.logContact(person.id, { date: l.date, via: l.via, text: l.text });
        summary.people.logged++;
      }
      if (c.company) {
        const key = companyKey(c.company);
        for (const j of jobs.filter((j) => companyKey(j.company) === key)) {
          // List rows carry no file path; the full read does.
          const note = fs.readFileSync(store.getJob(j.id).path, 'utf8');
          if (note.includes(`[[People/${person.id}`)) continue;
          people.attachPerson(j.id, person.id, { role: c.role, context: `LinkedIn, ${c.last}` });
          summary.people.attached++;
        }
      }
    }
  }

  return summary;
}
