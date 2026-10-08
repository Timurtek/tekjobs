// The LinkedIn import: reads the export in place (scraper/linkedin.mjs) and writes only into the profile folder:
// the index the app answers "who do I know there" from, and People notes for the recruiters and hiring managers
// who wrote lately. Re-running is safe: people are recognised, not duplicated; log lines already present are not
// appended again.
import fs from 'node:fs';
import path from 'node:path';
import { loadCriteria, P, DATA_DIR, localDay } from '../../scraper/config.mjs';
import { readExport, buildIndex, peopleCandidates, warmPaths, companyKey, sameCompany } from '../../scraper/linkedin.mjs';
import * as people from './people.mjs';
import * as store from './store.mjs';
import { writeJobNote } from '../../scraper/vault.mjs';
import { scoreJob, normalizeTitle } from '../../scraper/score.mjs';
import { htmlToText } from '../../scraper/sources.mjs';

const isoDay = (d = new Date()) => localDay(d);
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

// ---------------- applications and saved jobs, as notes ----------------
// The export carries the person's own record of where they applied through LinkedIn and what they saved. Opt-in:
// each becomes a note (or a line on the note that already exists), so the pipeline shows the search they were
// already running. The posting itself is never fetched; the note carries the LinkedIn link for the person to open.
const titleKey = (t) => normalizeTitle(t).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const sameTitle = (a, b) => { const x = titleKey(a), y = titleKey(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };
const hash = (s) => { let h = 5381; for (const ch of String(s)) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0; return h.toString(16); };
const noteText = (id) => { try { return fs.readFileSync(store.getJob(id).path, 'utf8'); } catch { return ''; } };
// Empty or absent: a note written by hand or by an older version may not carry the field at all.
const appliedOnEmpty = (id) => !/^- \*\*Applied on:\*\*[ \t]*\S/m.test(noteText(id));
const noteOnce = (id, line) => { if (!noteText(id).includes(line)) store.addNote(id, line, 'linkedin-export'); };

function findNote(jobs, { company, title, url }) {
  const clean = (u) => String(u || '').split('?')[0].replace(/\/$/, '');
  const byUrl = url && jobs.find((j) => j.url && clean(j.url) === clean(url));
  if (byUrl) return byUrl;
  return jobs.filter((j) => sameCompany(j.company, company)).find((j) => sameTitle(j.title, title)) || null;
}
function stubFor(kind, r) {
  const html = kind === 'application'
    ? `<p>Applied through LinkedIn on ${r.date}. From the LinkedIn data export: the posting itself was not read, so there is no description or pay here. Open the link for the posting.</p>`
    : `<p>Saved on LinkedIn on ${r.date}. From the LinkedIn data export: the posting itself was not read. Open the link for the posting.</p>`;
  const job = {
    id: `linkedin:${kind}:${hash(`${r.url || ''}|${r.company}|${r.title}|${r.date}`)}`, source: 'linkedin-export', company: r.company, title: r.title || 'Role not named in the export',
    url: r.url || '', location: '', remote: false, posted: r.date, descriptionHtml: html, foundVia: kind === 'application' ? 'from the LinkedIn export: an application' : 'from the LinkedIn export: a saved job', addedBy: 'linkedin-export',
  };
  job.descriptionText = htmlToText(job.descriptionHtml);
  return job;
}

/** What importing the applications and saved jobs would touch: per kind, the notes it would mark and the ones it would create. */
export function planJobs(index, { since = index?.since || '', applications = false, saved = false } = {}) {
  const jobs = store.listJobs();
  const recent = (d) => !since || (d && d >= since);
  const one = (rows, on) => {
    const out = { matched: [], create: [], skipped: 0 };
    if (!on) return out;
    for (const r of rows || []) {
      if (!recent(r.date) || !r.company) { out.skipped++; continue; }
      const note = findNote(jobs, r);
      if (note) out.matched.push({ id: note.id, status: note.status, date: r.date, company: r.company, title: r.title });
      else out.create.push(r);
    }
    return out;
  };
  return { since, applications: one(index?.applications, applications), saved: one(index?.savedJobs, saved) };
}

/**
 * Applications become notes at "applied" with the date; saved jobs become notes at "reviewing". A note that already
 * exists gets the line and, for an application, the status and the date if it had none. Re-running changes nothing.
 * The status is set via "linkedin-export": the person's own record is the evidence, so the human-only rule for agents
 * does not apply, and the status log says where it came from.
 */
export function importJobs(source, { since = daysAgo(90), applications = false, saved = false, dry = false } = {}) {
  const index = buildIndex(readExport(source), { since });
  const plan = planJobs(index, { since: index.since, applications, saved });
  const out = { since: index.since, dry, applications: { matched: 0, marked: 0, created: 0, skipped: plan.applications.skipped }, saved: { matched: 0, created: 0, skipped: plan.saved.skipped } };
  // A profile with no criteria yet (the import can run before the interview) still gets its notes; they are scored later by a rescore.
  let criteria; try { criteria = loadCriteria(); } catch { criteria = { titleTerms: {}, titleExclude: [], descTerms: {}, minScore: 0 }; }
  const advanced = ['applied', 'interviewing', 'offer', 'rejected'];
  for (const m of plan.applications.matched) {
    out.applications.matched++;
    if (dry) continue;
    if (!advanced.includes(m.status)) { store.setStatus(m.id, 'applied', 'linkedin-export'); out.applications.marked++; }
    if (appliedOnEmpty(m.id)) store.saveApplicationDraft(m.id, { field: 'Applied on', value: m.date });
    noteOnce(m.id, `Applied through LinkedIn on ${m.date} (from the LinkedIn export).`);
  }
  for (const r of plan.applications.create) {
    out.applications.created++;
    if (dry) continue;
    const job = stubFor('application', r);
    const id = path.basename(writeJobNote(job, scoreJob(job, criteria), criteria), '.md');
    store.cacheClear?.();
    store.setStatus(id, 'applied', 'linkedin-export');
    if (appliedOnEmpty(id)) store.saveApplicationDraft(id, { field: 'Applied on', value: r.date });
  }
  for (const m of plan.saved.matched) {
    out.saved.matched++;
    if (dry) continue;
    noteOnce(m.id, `Saved on LinkedIn on ${m.date} (from the LinkedIn export).`);
  }
  for (const r of plan.saved.create) {
    out.saved.created++;
    if (dry) continue;
    const job = stubFor('saved', r);
    const id = path.basename(writeJobNote(job, scoreJob(job, criteria), criteria), '.md');
    store.cacheClear?.();
    store.setStatus(id, 'reviewing', 'linkedin-export');
  }
  store.cacheClear?.();
  return out;
}
