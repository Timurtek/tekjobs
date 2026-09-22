// The vault is the database. This module reads the TekJobs Obsidian vault (job notes, criteria, companies, logs)
// and performs the few writes the app is allowed to make: change a job's status, append a note, save an
// application draft, edit the criteria JSON block, append a company row. It never rewrites anything else.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { P, VAULT, loadCriteria, loadCompanies, criteriaPresetFile } from '../../src/config.mjs';
import { readFrontmatter, LEGACY_NARRATIVE_DEFAULT } from '../../src/vault.mjs';
import { weightsFingerprint, titlePoints, recencyPoints, payPoints } from '../../src/rescore.mjs';
import { RESUME_NOTE, LEGACY_RESUME_NOTES } from '../../src/resume-sync.mjs';
import { onboardingStatus, onboardingMaterials, importResume, saveProfile, fetchLink, initProfile } from '../../src/profile.mjs';
export { onboardingStatus, onboardingMaterials, importResume, saveProfile, fetchLink, initProfile };

const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // the scraper repo root
const isoDay = () => new Date().toISOString().slice(0, 10);
const DE = /design (engineer|technologist|system)|ux engineer|ui engineer|creative technologist|prototyp/i;
// `ready` is the approval boundary: a packet drafted and waiting on a person. `reviewing` already serves as
// shortlisted and `applying` as preparing, so this is the one state the pipeline was missing rather than a
// new model imposed on notes that already exist.
const STATUSES = ['new', 'reviewing', 'applying', 'ready', 'applied', 'interviewing', 'offer', 'rejected', 'passed'];
export { STATUSES, VAULT };

// ---------- jobs ----------
const cache = { key: '', rows: [] };
function dirKey() {
  const files = fs.readdirSync(P.jobs).filter((f) => f.endsWith('.md'));
  let key = String(files.length);
  for (const f of files) key += ':' + fs.statSync(path.join(P.jobs, f)).mtimeMs;
  return key;
}
/** Forget the row cache; for callers outside this module that write a note directly. */
export function cacheClear() { cache.key = ''; }
export function listJobs() {
  if (!fs.existsSync(P.jobs)) return [];
  const key = dirKey();
  if (key === cache.key) return cache.rows;
  const rows = fs.readdirSync(P.jobs).filter((f) => f.endsWith('.md')).map((f) => {
    const file = path.join(P.jobs, f);
    const fm = readFrontmatter(file);
    // The packet count comes from the note body, not the frontmatter, so a note edited by hand in Obsidian
    // counts the same as one written through the app. Both reads land in the same cache, which only misses
    // when a file's mtime changes.
    return fm ? rowOf(fm, fs.readFileSync(file, 'utf8')) : null;
  }).filter(Boolean);
  cache.key = key; cache.rows = rows;
  return rows;
}

/**
 * How many application fields a note has something in.
 *
 * Scoped twice, because both scopes are load-bearing: to the Application section, since job descriptions are
 * full of their own `- **Stack:** …` lines, and to the known field names, since a reader may add bullets of
 * their own there. Without either, every note in the vault reads as a started packet.
 */
function countPacketFields(text = '') {
  const section = (text.match(/^## Application\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/m) || [, ''])[1];
  if (!section) return 0;
  let n = 0;
  for (const { field } of APPLICATION_FIELDS) {
    const m = section.match(new RegExp(`^- \\*\\*${escapeRe(field)}:\\*\\*(.*)$`, 'm'));
    const value = m ? m[1].trim() : '';
    if (!value) continue;
    // A note written before the template stopped pre-filling this carries a narrative nobody chose.
    if (field === 'Narrative' && value === LEGACY_NARRATIVE_DEFAULT) continue;
    n++;
  }
  return n;
}

function rowOf(fm, text = '') {
  return {
    id: fm._name,
    company: fm.company || '', title: fm.title || '', location: fm.location || '',
    remote: fm.remote === 'true' || isRemoteRow({ remote: false, location: fm.location || '' }), source: fm.source || '', url: fm.url || '',
    score: Number(fm.score) || 0, posted: fm.posted || '', found: fm.found || '',
    salary: fm.salary || '', salaryMax: Number(fm.salary_max) || 0, payBand: fm.pay_band || 'unknown',
    status: fm.status || 'new', listing: String(fm.listing || 'open').startsWith('open') ? 'open' : String(fm.listing),
    kind: DE.test(fm.title || '') ? 'design-eng' : 'adjacent', department: fm.department || '', jobId: fm.job_id || '',
    passedReason: fm.passed_reason || '',
    // "link" when the person pasted it (Add by link); scanned notes carry no added_by line.
    addedBy: fm.added_by || 'scan',
    packet: countPacketFields(text),
  };
}
// The scan's remote flag comes from the board's own workplace field, which some boards leave unset on a posting
// whose location text plainly says "Remote". Either counts.
export const isRemoteRow = (r) => r.remote || /\b(remote|anywhere|distributed|work from home|wfh)\b/i.test(r.location || '');
// A list filter value is one name, a comma-separated list, or an array; "all" or nothing means no filter.
const listOf = (v) => new Set([].concat(v || []).flatMap((s) => String(s).split(',')).map((s) => s.trim()).filter((s) => s && s !== 'all'));
const withinDays = (iso, days) => !!iso && (Date.now() - new Date(iso).getTime()) / 86400000 <= Number(days);
const num = (v) => (v === '' || v == null ? null : Number(v));

/**
 * Every filter the Jobs view, the API and the MCP tool share. Pay filters read the top of the stated range
 * (salaryMax), which is the number the pay band is judged on; a posting with no stated pay passes "pay at
 * least" only when it is not asked to state one (payKnown).
 */
export function filterJobs(f = {}) {
  const { q = '', location = '', status, band, kind, source, company, minScore, maxScore, payMin, payMax, payKnown = false, postedDays, foundDays, remoteOnly = false, openOnly = true } = f;
  const ql = String(q).trim().toLowerCase();
  // source values are the note's source (ashby, greenhouse, wellfound…); the special value "link" means every
  // note added by pasting a link, whatever board it turned out to be on.
  const sources = listOf(source), statuses = listOf(status), bands = listOf(band), kinds = listOf(kind);
  const companies = new Set([...listOf(company)].map((s) => s.toLowerCase()));
  // Whole words, so "wa" finds "Seattle, WA" and not "Hawaii".
  const locTerms = String(location).split(',').map((s) => s.trim()).filter(Boolean).map((t) => new RegExp(`(^|[^a-z])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z])`, 'i'));
  // No minScore means no floor at all. A note created from an email or a pasted link can carry a negative
  // score (nothing for the title terms to match, no location), and it must still show on the board.
  const lo = num(minScore), hi = num(maxScore), pMin = num(payMin), pMax = num(payMax), pd = num(postedDays), fd = num(foundDays);
  return listJobs().filter((r) => (!statuses.size || statuses.has(r.status))
    && (!bands.size || bands.has(r.payBand))
    && (!kinds.size || kinds.has(r.kind))
    && (!sources.size || sources.has(r.source) || (sources.has('link') && r.addedBy === 'link'))
    && (!companies.size || companies.has(String(r.company).toLowerCase()))
    && (lo == null || r.score >= lo) && (hi == null || r.score <= hi)
    && (!payKnown || r.salaryMax > 0)
    && (!pMin || r.salaryMax >= pMin)
    && (!pMax || (r.salaryMax > 0 && r.salaryMax <= pMax))
    && (!pd || withinDays(r.posted, pd))
    && (!fd || withinDays(r.found, fd))
    && (!remoteOnly || isRemoteRow(r))
    && (!openOnly || r.listing === 'open')
    && (!locTerms.length || locTerms.some((t) => t.test(r.location)))
    && (!ql || `${r.company} ${r.title} ${r.location}`.toLowerCase().includes(ql)));
}
export function searchJobs({ sort = 'score', dir = 'desc', limit = 500, offset = 0, ...f } = {}) {
  const rows = filterJobs(f);
  const d = dir === 'asc' ? 1 : -1;
  rows.sort((a, b) => { const va = a[sort], vb = b[sort]; return (typeof va === 'string' ? va.localeCompare(vb) : (va || 0) - (vb || 0)) * d; });
  return { total: rows.length, rows: rows.slice(offset, offset + limit) };
}
/**
 * Counts per filter value under the current filters, each dimension counted with its own filter lifted, so a
 * picker shows what choosing each value would give rather than only what is already chosen. Pay comes back as
 * a spread of the stated tops of range, for setting the pay fields with the eyes open.
 */
export function jobFacets(f = {}) {
  const count = (rows, key) => rows.reduce((a, r) => { const k = key(r); if (k) a[k] = (a[k] || 0) + 1; return a; }, {});
  const without = (...dims) => filterJobs(Object.fromEntries([...Object.entries(f), ...dims.map((d) => [d, undefined])]));
  const sourceRows = without('source');
  const source = count(sourceRows, (r) => r.source);
  const link = sourceRows.filter((r) => r.addedBy === 'link').length;
  if (link) source.link = link;
  const remoteRows = without('remoteOnly');
  const payRows = without('payMin', 'payMax', 'payKnown');
  const tops = payRows.map((r) => r.salaryMax).filter((n) => n > 0).sort((a, b) => a - b);
  return {
    total: filterJobs(f).length,
    status: count(without('status'), (r) => r.status),
    band: count(without('band'), (r) => r.payBand),
    kind: count(without('kind'), (r) => r.kind),
    source,
    company: count(without('company'), (r) => r.company),
    remote: { remote: remoteRows.filter(isRemoteRow).length, onsite: remoteRows.filter((r) => !isRemoteRow(r)).length },
    pay: { stated: tops.length, unstated: payRows.length - tops.length, min: tops[0] || 0, max: tops[tops.length - 1] || 0, median: tops[Math.floor(tops.length / 2)] || 0 },
  };
}
/** The same filters, read off a query string (the API) so the two routes and the UI agree on names. */
export function filtersFromParams(q) {
  const g = (k) => q.get(k) ?? undefined;
  return { q: g('q') || '', location: g('location') || '', status: g('status'), band: g('band'), kind: g('kind'), source: g('source'), company: g('company'), minScore: g('minScore'), maxScore: g('maxScore'), payMin: g('payMin'), payMax: g('payMax'), payKnown: g('payKnown') === '1', postedDays: g('postedDays'), foundDays: g('foundDays'), remoteOnly: g('remote') === '1', openOnly: g('closed') !== '1' };
}
function notePath(id) {
  const safe = path.basename(String(id)).replace(/\.md$/, '');
  const file = path.join(P.jobs, safe + '.md');
  if (!fs.existsSync(file)) throw Object.assign(new Error(`No job note named "${safe}"`), { status: 404 });
  return file;
}
/**
 * The heading a note keeps the reader's own notes under.
 *
 * New notes are written with "Notes". Notes written before the heading was generalised say "Tek's notes",
 * and are not rewritten: an existing note is the person's record, and a migration that touches every file to
 * change one line is a worse trade than reading both. Whichever heading a note already has is the one it
 * keeps; only a note that has neither gets the current default.
 */
const NOTES_HEADING = 'Notes';
const LEGACY_NOTES_HEADING = "Tek's notes";
function notesHeading(text) {
  if (new RegExp(`^## ${NOTES_HEADING}[ \\t]*$`, 'm').test(text)) return NOTES_HEADING;
  if (new RegExp(`^## ${LEGACY_NOTES_HEADING}[ \\t]*$`, 'm').test(text)) return LEGACY_NOTES_HEADING;
  return NOTES_HEADING;
}

export function getJob(id) {
  const file = notePath(id);
  const text = fs.readFileSync(file, 'utf8');
  const fm = readFrontmatter(file);
  const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  // A section runs to the next "## " heading or the true end of the note (not the end of a line: `$` is per-line under /m).
  const section = (h) => { const m = body.match(new RegExp(`^## ${h}\\s*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm')); return m ? m[1].trim() : ''; };
  // Where the note is, and a link Obsidian opens it from; `path=` works whatever the vault is called.
  return { ...rowOf(fm), path: file, obsidianUrl: `obsidian://open?path=${encodeURIComponent(file)}`, body, sections: { why: section("Why it matched"), log: section('Status log'), notes: section(notesHeading(text)), application: section('Application'), coverLetter: section('Cover letter').replace(/^>.*\r?\n?/gm, '').trim(), description: section('Job description') } };
}
function replaceFrontmatterLine(text, key, value) {
  const re = new RegExp(`^${key}: .*$`, 'm');
  return re.test(text) ? text.replace(re, `${key}: ${value}`) : text.replace(/^---\r?\n/, `---\n${key}: ${value}\n`);
}
function appendUnderHeading(text, heading, line) {
  // `[ \t]*\n` rather than `\s*\n`: a greedy \s would swallow the blank lines after the heading into the heading group.
  const re = new RegExp(`(^## ${heading}[ \\t]*\\n)([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm');
  if (!re.test(text)) return text.trimEnd() + `\n\n## ${heading}\n${line}\n`;
  return text.replace(re, (all, h, content) => { const body = content.trim(); return `${h}${body ? body + '\n' : ''}${line}\n\n`; });
}
/**
 * Why a match was passed on. Recorded so the criteria can be argued with later from evidence rather than
 * memory — a pass with no reason teaches nothing, and after three hundred of them the record is the only
 * thing that can say which rule is wrong.
 */
export const PASS_REASONS = ['wrong role shape', 'weak evidence match', 'compensation', 'location or authorisation', 'too managerial', 'too visual', 'too engineering', 'stale or duplicate', 'company'];

/**
 * Statuses an agent may not set, and why.
 *
 * `applied` is not a preference, it is a claim that something was sent to another person. Nothing in this
 * system can send an application, so nothing in it can truthfully record one — only the person who did it
 * knows. An agent that drafts a packet moves it to `ready` and stops there; the human moves it on.
 * `interviewing` and `offer` are the same kind of claim, about events outside this machine entirely.
 */
const HUMAN_ONLY_STATUSES = ['applied', 'interviewing', 'offer'];

export function setStatus(id, status, via = 'app', reason = '') {
  if (!STATUSES.includes(status)) throw Object.assign(new Error(`status must be one of ${STATUSES.join(', ')}`), { status: 400 });
  if (reason && !PASS_REASONS.includes(reason)) throw Object.assign(new Error(`reason must be one of ${PASS_REASONS.join(', ')}`), { status: 400 });
  if (via === 'mcp' && HUMAN_ONLY_STATUSES.includes(status)) {
    throw Object.assign(new Error(`"${status}" records something that happened outside this machine, so only a person can set it. Move the packet to "ready" and ask them.`), { status: 403 });
  }
  const file = notePath(id);
  let text = fs.readFileSync(file, 'utf8');
  const before = (text.match(/^status: (.*)$/m) || [])[1] || 'new';
  if (before === status) return getJob(id);
  text = replaceFrontmatterLine(text, 'status', status);
  if (reason) text = replaceFrontmatterLine(text, 'passed_reason', JSON.stringify(reason));
  text = appendUnderHeading(text, 'Status log', `- ${isoDay()} — ${before} → **${status}**${reason ? ` (${reason})` : ''} (via ${via})`);
  fs.writeFileSync(file, text);
  cache.key = '';
  return getJob(id);
}
export function addNote(id, note, via = 'app') {
  const file = notePath(id);
  let text = fs.readFileSync(file, 'utf8');
  text = appendUnderHeading(text, notesHeading(text), `- ${isoDay()} (${via}): ${String(note).trim()}`);
  fs.writeFileSync(file, text);
  return getJob(id);
}
/**
 * The application packet: what has to exist before a person can decide whether to send something.
 *
 * `required` is the subset that has to be filled before the packet counts as ready for a human to approve.
 * The rest are useful and often empty — not every application needs a referral or an outreach message, and
 * a checklist that demands them teaches people to fill boxes rather than to think.
 *
 * The first six are the fields the note template has always had; the rest were added with the packet, and
 * are appended to a note's Application section the first time they are saved. Nothing is rewritten.
 */
export const APPLICATION_FIELDS = [
  { field: 'Narrative', hint: 'Which story leads: design engineer, or AI systems.', required: true },
  { field: 'Resume variant', hint: 'Which base resume this starts from.', required: true },
  { field: 'Tailored summary', hint: 'The opening paragraph, rewritten for this posting.', required: true },
  { field: 'Tailored bullets', hint: 'The three or four bullets that answer this posting’s requirements.', required: true },
  { field: 'Portfolio', hint: 'Which projects to feature, and why these.', required: false },
  { field: 'Cover letter', hint: 'Optional. Only where it is read.', required: false },
  { field: 'Questions', hint: 'The posting’s own questions, with answers you have verified.', required: false },
  { field: 'Risks', hint: 'Gaps a reader will notice, and what to say about them.', required: true },
  { field: 'Outreach message', hint: 'To a recruiter or a referral, if there is one.', required: false },
  { field: 'Contact / referral', hint: 'Who, and how you know them.', required: false },
  { field: 'Deadline', hint: 'When this closes, if it says.', required: false },
  { field: 'Applied on', hint: 'Filled when you actually send it.', required: false },
  { field: 'Follow-up due', hint: 'When to chase, if nothing comes back.', required: false },
];
const FIELD_NAMES = APPLICATION_FIELDS.map((f) => f.field);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function saveApplicationDraft(id, { field, value }) {
  if (!FIELD_NAMES.includes(field)) throw Object.assign(new Error(`field must be one of ${FIELD_NAMES.join(', ')}`), { status: 400 });
  const file = notePath(id);
  let text = fs.readFileSync(file, 'utf8');
  const re = new RegExp(`^- \\*\\*${escapeRe(field)}:\\*\\*.*$`, 'm');
  // Newlines are flattened: the Application section is a list, and a multi-line value would break the
  // next field out of it. Long prose belongs in the note body, and the packet points at it.
  const line = `- **${field}:** ${String(value).replace(/\r?\n/g, ' ').trim()}`;
  text = re.test(text) ? text.replace(re, line) : appendUnderHeading(text, 'Application', line);
  fs.writeFileSync(file, text);
  cache.key = '';
  return getJob(id);
}

/**
 * Long drafts (the cover letter, the tailored resume) live in the note body under their own headings, not in
 * the Application list: that list is one line per field, and these are paragraphs. The packet field points
 * at the section. Sections are placed before "## Job description" so the person's material stays above the
 * posting's. Function replacements throughout: a draft can contain "$" and String.replace reads "$&".
 */
const sectionRe = (heading) => new RegExp(`^## ${heading}[ \\t]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm');
export function getSection(id, heading) {
  const m = fs.readFileSync(notePath(id), 'utf8').match(sectionRe(heading));
  return m ? m[1].replace(/^>.*\r?\n?/gm, '').trim() : '';
}
export function saveSection(id, heading, body, banner) {
  const file = notePath(id);
  let text = fs.readFileSync(file, 'utf8');
  const block = `## ${heading}\n> ${banner}\n\n${String(body).trim()}\n\n`;
  if (sectionRe(heading).test(text)) text = text.replace(sectionRe(heading), () => block);
  else if (/^## Job description[ \t]*$/m.test(text)) text = text.replace(/^## Job description[ \t]*$/m, () => `${block}## Job description`);
  else text = `${text.trimEnd()}\n\n${block}`;
  fs.writeFileSync(file, text);
  cache.key = '';
  return getSection(id, heading);
}
export { isoDay };

const LETTER_HEADING = 'Cover letter';
export function getCoverLetter(id) { return getSection(id, LETTER_HEADING); }
export function saveCoverLetter(id, letter, via = 'app') {
  const words = String(letter).trim().split(/\s+/).length;
  saveSection(id, LETTER_HEADING, letter, `Drafted ${isoDay()} (via ${via}), ${words} words. A draft: read it, edit it, send it yourself.`);
  saveApplicationDraft(id, { field: 'Cover letter', value: `Drafted ${isoDay()}, ${words} words. Full text under "Cover letter" in this note.` });
  return getCoverLetter(id);
}

/**
 * The packet as structured data, plus what it is still missing.
 *
 * `ready` says only that every required field has something in it. It is not a judgement that the
 * application is good, and nothing in this codebase treats it as permission to send anything.
 */
export function applicationPacket(id) {
  const text = fs.readFileSync(notePath(id), 'utf8');
  const values = {};
  for (const { field } of APPLICATION_FIELDS) {
    const m = text.match(new RegExp(`^- \\*\\*${escapeRe(field)}:\\*\\*(.*)$`, 'm'));
    values[field] = m ? m[1].trim() : '';
  }
  const missing = APPLICATION_FIELDS.filter((f) => f.required && !values[f.field]).map((f) => f.field);
  const filled = FIELD_NAMES.filter((f) => values[f]).length;
  return { id, fields: APPLICATION_FIELDS, values, missing, ready: missing.length === 0, filled, total: FIELD_NAMES.length };
}

// ---------- summary & runs ----------
export function runs() {
  if (!fs.existsSync(P.logs)) return [];
  return fs.readdirSync(P.logs).filter((f) => f.endsWith('.md')).sort().reverse().slice(0, 30).map((f) => {
    const text = fs.readFileSync(path.join(P.logs, f), 'utf8');
    const blocks = [...text.matchAll(/^## Run (.+?)\n([\s\S]*?)(?=^## Run |(?![\s\S]))/gm)].map((m) => {
      const b = m[2];
      const g = (re) => (b.match(re) || [])[1];
      return { when: m[1].trim(), boardsOk: Number(g(/Boards: (\d+)\//)), boardsTotal: Number(g(/Boards: \d+\/(\d+)/)), scanned: Number((g(/postings scanned: ([\d,]+)/) || '0').replace(/,/g, '')), matched: Number(g(/scored ≥ \d+: (\d+)/)), newMatches: Number(g(/\*\*new: (\d+)\*\*/)), closed: Number(g(/closed: (\d+)/)), seconds: Number(g(/([\d.]+)s/)), failed: g(/Failed slugs: (.+)/) || '', criteria: g(/^- Criteria: (.+)$/m) || '' };
    });
    return { date: f.replace(/\.md$/, ''), runs: blocks };
  });
}
export function summary() {
  const rows = listJobs().filter((r) => r.listing === 'open');
  const count = (k) => rows.reduce((m, r) => ((m[r[k]] = (m[r[k]] || 0) + 1), m), {});
  const de = rows.filter((r) => r.kind === 'design-eng');
  const lastLog = runs()[0]; const last = lastLog?.runs?.at(-1) || null;
  const criteria = safe(() => loadCriteria(), {});
  return {
    open: rows.length, byStatus: count('status'), byBand: count('payBand'), byKind: count('kind'), bySource: count('source'),
    designEng: { total: de.length, floor: de.filter((r) => r.payBand === 'floor').length, stretch: de.filter((r) => r.payBand === 'stretch').length, unknown: de.filter((r) => r.payBand === 'unknown').length },
    active: rows.filter((r) => ['applying', 'applied', 'interviewing', 'offer'].includes(r.status)).length,
    lastRun: last ? { ...last, date: lastLog.date } : null,
    floor: criteria.salary?.minAnnual || null, stretch: criteria.salary?.stretchAnnual || null, minScore: criteria.minScore || null,
    ceiling: fitCeiling(criteria),
    companies: safe(() => loadCompanies().length, 0), vault: VAULT,
  };
}
const safe = (fn, d) => { try { return fn(); } catch { return d; } };

// ---------- today ----------

/**
 * The best score this criteria set can produce, used to turn the raw score into a 0-100 fit.
 *
 * The raw score is additive and unbounded, which is right for ranking and useless for judging: "125" means
 * nothing without knowing what was available. This computes the ceiling from the criteria themselves.
 *
 * One assumption, stated because it is arguable: scoreJob pays 5 points for every title term beyond the
 * first, with no cap, so the theoretical maximum is however many terms the profile has. A real posting hits
 * two or three, so the ceiling allows for three. A job that somehow hits more simply reads as 100.
 */
export function fitCeiling(c = {}) {
  const top = (o) => Math.max(0, ...Object.values(o || {}).map(Number).filter(Number.isFinite));
  return Math.max(1, Math.round(
    top(c.titleTerms) + 2 * 5 +
    top(c.seniority?.boost) +
    (c.descCap ?? 35) +
    (c.location?.remoteBoost ?? 0) + (c.location?.bayAreaBoost ?? 0) +
    (c.salary?.meetsBonus ?? 10) +
    (c.recency?.days7 ?? 0),
  ));
}
const toFit = (raw, ceiling) => Math.max(0, Math.min(100, Math.round((Number(raw) || 0) / ceiling * 100)));

/** The `- **Follow-up due:**` line from a note's Application section, or ''. Only worth reading for the few
 *  jobs actually in flight, so it is never called across the whole vault. */
function applicationField(id, label) {
  try {
    const text = fs.readFileSync(notePath(id), 'utf8');
    const esc = label.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
    const m = text.match(new RegExp(`^- \\*\\*${esc}:\\*\\*(.*)$`, 'm'));
    return m ? m[1].trim() : '';
  } catch { return ''; }
}

const IN_FLIGHT = ['applying', 'applied', 'interviewing', 'offer'];

/**
 * The short list of things that actually want a decision today, as opposed to the whole inventory.
 *
 * Measured on this vault before it was written: every listing that closed did so within seven days of being
 * found, median two. So an unreviewed match is a perishable thing, and the section that matters most is not
 * the ranked pile but the one about to disappear.
 *
 * Sections three to five read the pipeline, which is empty until the pipeline is used. They return empty
 * arrays rather than being hidden, so the page shows the shape of the work even before there is any.
 */
export function today({ cap = 7, agingDays = 2 } = {}) {
  const rows = listJobs();
  const criteria = safe(() => loadCriteria(), {});
  const ceiling = fitCeiling(criteria);
  const withFit = (r) => ({ ...r, fit: toFit(r.score, ceiling) });
  const daysSince = (d) => (d ? Math.floor((Date.now() - Date.parse(d)) / 864e5) : null);

  const open = rows.filter((r) => r.listing === 'open');
  const unreviewed = open.filter((r) => r.status === 'new');

  const triage = [...unreviewed].sort((a, b) => b.score - a.score).slice(0, cap).map(withFit);
  const triageIds = new Set(triage.map((r) => r.id));

  // Still open, still untouched, and already past the age at which listings here start disappearing.
  const aging = unreviewed
    .filter((r) => !triageIds.has(r.id) && (daysSince(r.found) ?? 0) >= agingDays)
    .sort((a, b) => b.score - a.score)
    .slice(0, cap)
    .map((r) => ({ ...withFit(r), days: daysSince(r.found) }));

  // Closed while it was still sitting in the inbox: the cost of not having looked, made visible.
  const missedAll = rows
    .filter((r) => r.status === 'new' && r.listing.startsWith('closed') && (daysSince(r.listing.replace('closed ', '')) ?? 99) <= 7)
    .sort((a, b) => b.score - a.score);
  const missed = missedAll.slice(0, cap).map((r) => ({ ...withFit(r), closed: r.listing.replace('closed ', '') }));

  // Work already invested, wherever it ranks. A packet is the most expensive thing on this page — a drafted
  // summary, a named contact — and the fit score knows nothing about it, so a role can be half-prepared and
  // still fall off the bottom of the queue. Terminal statuses drop out; a closed listing does not, because a
  // packet on a job that just closed is the one thing here you want to hear about immediately.
  const DONE = ['applied', 'offer', 'rejected', 'passed'];
  const started = rows
    .filter((r) => r.packet > 0 && !DONE.includes(r.status) && !triageIds.has(r.id))
    .sort((a, b) => b.packet - a.packet || b.score - a.score)
    .slice(0, cap)
    .map((r) => ({ ...withFit(r), packet: r.packet, closed: r.listing.startsWith('closed') ? r.listing.replace('closed ', '') : '' }));

  const inFlight = rows.filter((r) => IN_FLIGHT.includes(r.status));
  const preparing = inFlight.filter((r) => r.status === 'applying').map((r) => ({ ...withFit(r), since: daysSince(r.found) }));
  const followUps = inFlight
    .map((r) => ({ ...withFit(r), due: applicationField(r.id, 'Follow-up due') }))
    .filter((r) => r.due)
    .sort((a, b) => a.due.localeCompare(b.due));
  const interviewing = inFlight.filter((r) => r.status === 'interviewing' || r.status === 'offer').map(withFit);

  return {
    generated: new Date().toISOString(),
    ceiling,
    // Real totals, not the capped section lengths: the point of the page is that the pile is bigger than the list.
    counts: { open: open.length, unreviewed: unreviewed.length, inFlight: inFlight.length, closedUnreviewed: missedAll.length, aging: unreviewed.filter((r) => (daysSince(r.found) ?? 0) >= agingDays).length, started: rows.filter((r) => r.packet > 0 && !DONE.includes(r.status)).length },
    sections: { triage, started, aging, missed, preparing, followUps, interviewing },
  };
}

// ---------- criteria & companies ----------
const JSON_BLOCK = /```json\s*\n([\s\S]*?)\n```/;
const replaceJsonBlock = (md, parsed) => md.replace(JSON_BLOCK, () => '```json\n' + JSON.stringify(parsed, null, 2) + '\n```');
export function getCriteria() {
  const md = fs.readFileSync(P.criteria, 'utf8');
  const m = md.match(JSON_BLOCK);
  const parsed = m ? safe(() => JSON.parse(m[1]), null) : null;
  return { raw: m ? m[1] : '', parsed, fingerprint: parsed ? weightsFingerprint(parsed) : '', path: P.criteria };
}
export function setCriteria(raw) {
  let parsed; try { parsed = JSON.parse(raw); } catch (e) { throw Object.assign(new Error(`Not valid JSON: ${e.message}`), { status: 400 }); }
  const md = fs.readFileSync(P.criteria, 'utf8');
  if (!JSON_BLOCK.test(md)) throw new Error('No ```json block in Search Criteria.md');
  fs.writeFileSync(P.criteria, replaceJsonBlock(md, parsed).replace(/^updated: .*$/m, `updated: ${isoDay()}`));
  return getCriteria();
}

/**
 * What a proposed criteria set would do to the notes that exist, before it is saved or scanned with.
 *
 * Uses the same three exact components `rescore` uses (title terms, recency at the age the posting had when
 * it was found, pay), computed with today's rules on both sides so an unchanged set previews as no change.
 * Description terms, seniority words and location rules take a scan to show, and the result says so. The
 * bar (minScore) is applied on both sides, so raising it alone still shows who falls out.
 */
export function previewCriteria(raw) {
  let proposed; try { proposed = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { throw Object.assign(new Error(`Not valid JSON: ${e.message}`), { status: 400 }); }
  const current = loadCriteria();
  const exact = (r, c) => {
    const ageAtScan = r.posted && r.found ? (Date.parse(r.found) - Date.parse(r.posted)) / 864e5 : NaN;
    return titlePoints(r.title, c, c.titleExtraCap ?? 10) + recencyPoints(ageAtScan, c.recency, true) + payPoints(r.salaryMax, c.salary, true);
  };
  const rows = listJobs().filter((r) => r.listing === 'open');
  const barBefore = Number(current.minScore ?? 0), barAfter = Number(proposed.minScore ?? 0);
  const scored = rows.map((r) => { const after = Math.round(r.score + exact(r, proposed) - exact(r, current)); return { id: r.id, company: r.company, title: r.title, status: r.status, before: r.score, after, delta: after - r.score }; });
  const top = (key) => [...scored].sort((a, b) => b[key] - a[key]).slice(0, 20).map((r) => r.id);
  const topBefore = top('before'), topAfter = top('after');
  const brief = (r) => ({ id: r.id, company: r.company, title: r.title, status: r.status, before: r.before, after: r.after, delta: r.delta });
  return {
    openNotes: rows.length,
    changed: scored.filter((r) => r.delta !== 0).length,
    barBefore, barAfter,
    aboveBefore: scored.filter((r) => r.before >= barBefore).length,
    aboveAfter: scored.filter((r) => r.after >= barAfter).length,
    rise: scored.filter((r) => r.before < barBefore && r.after >= barAfter).sort((a, b) => b.after - a.after).slice(0, 25).map(brief),
    fall: scored.filter((r) => r.before >= barBefore && r.after < barAfter).sort((a, b) => b.before - a.before).slice(0, 25).map(brief),
    enterTop20: topAfter.filter((id) => !topBefore.includes(id)).map((id) => brief(scored.find((r) => r.id === id))),
    leaveTop20: topBefore.filter((id) => !topAfter.includes(id)).map((id) => brief(scored.find((r) => r.id === id))),
    up: [...scored].filter((r) => r.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 10).map(brief),
    down: [...scored].filter((r) => r.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 10).map(brief),
    covers: 'title terms, recency and pay; description terms, seniority words and location rules show only after a scan',
  };
}

// ---------- outcomes ----------
// What the search is producing, from the notes: how far each job got, when it was applied to, and whether
// anything came back. Dates come from the status log lines the app and the MCP write ("2026-09-21 — new →
// **applied**"), from the packet's "Applied on" field when a person filled it, and from `found:`.
const RANK = { new: 0, reviewing: 1, applying: 2, ready: 3, applied: 4, interviewing: 5, offer: 6 };
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
export function outcomes({ agingDays = [7, 14, 21] } = {}) {
  const today = isoDay();
  const files = fs.existsSync(P.jobs) ? fs.readdirSync(P.jobs).filter((f) => f.endsWith('.md')) : [];
  const jobs = files.map((f) => {
    const text = fs.readFileSync(path.join(P.jobs, f), 'utf8');
    const fm = readFrontmatter(path.join(P.jobs, f)) || {};
    const moves = [...text.matchAll(/^- (\d{4}-\d{2}-\d{2}) — .*?→ \*\*([a-z]+)\*\*/gm)].map((m) => ({ date: m[1], to: m[2] }));
    const reached = (s) => (RANK[fm.status] ?? -1) >= RANK[s] || moves.some((m) => (RANK[m.to] ?? -1) >= RANK[s]);
    const appliedOn = (text.match(/^- \*\*Applied on:\*\*\s*(\d{4}-\d{2}-\d{2})/m) || [])[1] || moves.find((m) => m.to === 'applied')?.date || (fm.status === 'applied' ? fm.found : '') || '';
    const applied = reached('applied') || !!appliedOn || (fm.status === 'rejected' && moves.some((m) => m.to === 'applied'));
    const responded = applied && (reached('interviewing') || fm.status === 'rejected');
    return { id: fm._name, company: fm.company || '', title: fm.title || '', source: fm.source || '', status: fm.status || 'new', found: fm.found || '', appliedOn, reviewed: fm.status !== 'new', shortlisted: reached('reviewing') || fm.status === 'applying' || fm.status === 'ready', applied, interviewing: reached('interviewing'), offer: reached('offer'), responded };
  });
  const appliedJobs = jobs.filter((j) => j.applied);
  const waiting = appliedJobs.filter((j) => j.status === 'applied' && j.appliedOn).map((j) => ({ ...j, days: dayDiff(j.appliedOn, today) })).sort((a, b) => b.days - a.days);
  const bySource = {};
  for (const j of appliedJobs) { const s = bySource[j.source] ||= { source: j.source, applied: 0, responded: 0 }; s.applied++; if (j.responded) s.responded++; }
  const weekOf = (d) => { const x = new Date(d); const day = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - day); return x.toISOString().slice(0, 10); };
  const perWeek = {};
  for (const j of appliedJobs) if (j.appliedOn) perWeek[weekOf(j.appliedOn)] = (perWeek[weekOf(j.appliedOn)] || 0) + 1;
  return {
    funnel: { found: jobs.length, reviewed: jobs.filter((j) => j.reviewed).length, shortlisted: jobs.filter((j) => j.shortlisted).length, applied: appliedJobs.length, interviewing: jobs.filter((j) => j.interviewing).length, offer: jobs.filter((j) => j.offer).length },
    responded: appliedJobs.filter((j) => j.responded).length,
    responseRate: appliedJobs.length ? appliedJobs.filter((j) => j.responded).length / appliedJobs.length : null,
    // A note created after the fact (from an email) was "found" after it was applied to; that is not a discovery time.
    medianDaysToApply: median(appliedJobs.filter((j) => j.appliedOn && j.found && j.appliedOn >= j.found).map((j) => dayDiff(j.found, j.appliedOn))),
    waiting: { total: waiting.length, buckets: Object.fromEntries(agingDays.map((d) => [d, waiting.filter((w) => w.days >= d).length])), oldest: waiting.slice(0, 8).map(({ id, company, title, appliedOn, days, source }) => ({ id, company, title, appliedOn, days, source })) },
    bySource: Object.values(bySource).map((s) => ({ ...s, rate: s.applied ? s.responded / s.applied : 0 })).sort((a, b) => b.applied - a.applied).slice(0, 8),
    appliedPerWeek: Object.entries(perWeek).sort().slice(-8).map(([week, n]) => ({ week, n })),
    passed: jobs.filter((j) => j.status === 'passed').length,
    rejected: jobs.filter((j) => j.status === 'rejected').length,
  };
}

// ---------- criteria presets ----------
// Named criteria sets under Targets/Criteria/, one note each, same ```json shape as Search Criteria.md.
// The daily scan uses the active note; a preset is for a different kind of search (a wider net, a different
// title, a lower floor) that runs on request: from the Runs page, or `tekjobs scan --criteria "<name>"`.
export function criteriaPresets() {
  if (!fs.existsSync(P.criteriaDir)) return [];
  const active = getCriteria().fingerprint;
  return fs.readdirSync(P.criteriaDir).filter((f) => f.endsWith('.md')).sort().map((f) => {
    const file = path.join(P.criteriaDir, f);
    const parsed = safe(() => loadCriteria(file), null);
    const fingerprint = parsed ? weightsFingerprint(parsed) : '';
    return { name: f.replace(/\.md$/, ''), file, valid: !!parsed, minScore: parsed?.minScore ?? null, floor: parsed?.salary?.minAnnual ?? null, titles: Object.keys(parsed?.titleTerms || {}).length, fingerprint, active: !!fingerprint && fingerprint === active, updated: fs.statSync(file).mtime.toISOString().slice(0, 10) };
  });
}
export function getCriteriaPreset(name) {
  const file = criteriaPresetFile(name);
  if (!fs.existsSync(file)) throw Object.assign(new Error(`No criteria preset named "${name}"`), { status: 404 });
  const m = fs.readFileSync(file, 'utf8').match(JSON_BLOCK);
  const parsed = m ? safe(() => JSON.parse(m[1]), null) : null;
  return { name: path.basename(file, '.md'), file, raw: m ? m[1] : '', parsed, fingerprint: parsed ? weightsFingerprint(parsed) : '' };
}
export function saveCriteriaPreset(name, raw) {
  let parsed; try { parsed = JSON.parse(raw); } catch (e) { throw Object.assign(new Error(`Not valid JSON: ${e.message}`), { status: 400 }); }
  const file = criteriaPresetFile(name);
  const clean = path.basename(file, '.md');
  fs.mkdirSync(P.criteriaDir, { recursive: true });
  if (fs.existsSync(file)) {
    const md = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, JSON_BLOCK.test(md) ? replaceJsonBlock(md, parsed).replace(/^updated: .*$/m, `updated: ${isoDay()}`) : `${md.replace(/\n+$/, '')}\n\n\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\`\n`);
  } else {
    fs.writeFileSync(file, [
      '---', 'type: criteria-preset', `updated: ${isoDay()}`, '---',
      `# ${clean}`, '',
      `> A criteria set the scan can run with instead of [[Targets/Search Criteria]]. Same JSON shape, same scoring. Load it on the app's Criteria page, make it the active set, or run one scan with it: \`tekjobs scan --criteria "${clean}"\`. Notes written by such a run carry this set's weights fingerprint.`, '',
      '```json', JSON.stringify(parsed, null, 2), '```', '',
    ].join('\n'));
  }
  return getCriteriaPreset(clean);
}
export function deleteCriteriaPreset(name) {
  const file = criteriaPresetFile(name);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  return criteriaPresets();
}
/** Copy a preset's JSON into Search Criteria.md, so the daily scan and every other reader use it. */
export function activateCriteriaPreset(name) {
  return setCriteria(getCriteriaPreset(name).raw);
}
export function companies() { return loadCompanies(); }

/**
 * Views the criteria imply, offered before the saved ones: the person's own bar, floor and remote rule turned
 * into links. They are computed, not stored, so they follow the criteria when it changes.
 */
export function defaultViews() {
  const c = safe(() => loadCriteria(), {}) || {};
  const floor = Number(c.salary?.minAnnual) || 0;
  const stretch = Number(c.salary?.stretchAnnual) || 0;
  const remote = !!c.location?.requireRemote;
  const k = (n) => `$${Math.round(n / 1000)}k`;
  const views = [
    { name: 'Design eng at floor', query: 'kind=design-eng&band=floor', hint: 'design-engineering titles with a stated range at or above your floor' },
    { name: 'New this week', query: 'status=new&foundDays=7', hint: 'unreviewed, found in the last seven days' },
  ];
  if (floor) views.push({ name: `${remote ? 'Remote, ' : ''}${k(floor)}+`, query: `${remote ? 'remote=1&' : ''}payMin=${floor}`, hint: `top of the stated range at least ${k(floor)}${remote ? ', remote' : ''}` });
  if (stretch && floor) views.push({ name: `Stretch ${k(stretch)} to ${k(floor)}`, query: 'band=stretch', hint: 'stated pay under the floor but above the stretch line' });
  views.push({ name: 'Waiting on a reply', query: 'status=applied', hint: 'applied, nothing back yet' });
  views.push({ name: 'Added by me', query: 'source=link,mail', hint: 'notes you added by link or from mail, whatever they scored' });
  return views;
}

// ---------- saved views ----------
// Named filter sets for the Jobs page, kept in the vault like every other setting: Targets/Job Views.md holds
// a ```json list of { name, query }, where query is the Jobs page's own query string.
const VIEWS_FILE = path.join(VAULT, 'Targets', 'Job Views.md');
export function getViews() {
  if (!fs.existsSync(VIEWS_FILE)) return [];
  const m = fs.readFileSync(VIEWS_FILE, 'utf8').match(JSON_BLOCK);
  const list = m ? safe(() => JSON.parse(m[1]), []) : [];
  return Array.isArray(list) ? list.filter((v) => v && v.name && typeof v.query === 'string') : [];
}
export function saveViews(list) {
  const clean = [].concat(list || []).filter((v) => v && v.name && typeof v.query === 'string').map((v) => ({ name: String(v.name).trim().slice(0, 60), query: String(v.query).replace(/^\?/, '').slice(0, 2000) })).filter((v) => v.name);
  const body = fs.existsSync(VIEWS_FILE) && JSON_BLOCK.test(fs.readFileSync(VIEWS_FILE, 'utf8'))
    ? replaceJsonBlock(fs.readFileSync(VIEWS_FILE, 'utf8'), clean).replace(/^updated: .*$/m, `updated: ${isoDay()}`)
    : ['---', 'type: config', `updated: ${isoDay()}`, '---', '# Job views', '', '> Saved filter sets for the app\'s Jobs page. Each `query` is the page\'s own query string; open one as `/#/jobs?<query>`. The app reads and writes this list; edit it here if you like.', '', '```json', JSON.stringify(clean, null, 2), '```', ''].join('\n');
  fs.writeFileSync(VIEWS_FILE, body);
  return getViews();
}
/** Show the note in the file manager (Explorer, Finder, or the desktop's default), selected where it can be. */
export function revealJob(id) {
  const file = notePath(id);
  const [bin, args] = process.platform === 'win32' ? ['explorer', [`/select,${file}`]]
    : process.platform === 'darwin' ? ['open', ['-R', file]]
    : ['xdg-open', [path.dirname(file)]];
  spawn(bin, args, { detached: true, stdio: 'ignore' }).unref();
  return { ok: true, path: file };
}

/**
 * Attach the real posting to a note that was created without one (from an email, or a thin page). The note
 * keeps its name, status, status log, notes, packet, letter and tailored resume; the posting's own facts
 * replace the frontmatter's, the score is recomputed from the posting, and the description section is
 * replaced. A person asks for this on a specific note, so it is the one place the app rewrites what it wrote.
 */
export async function attachPosting(id, href) {
  const file = notePath(id);
  const { readLink } = await import('../../src/import-link.mjs');
  const { weightsFingerprint: fp } = await import('../../src/rescore.mjs');
  const { loadSeen, saveSeen } = await import('../../src/vault.mjs');
  const criteria = loadCriteria();
  const r = await readLink(href, { criteria });
  if (!r.ok) throw Object.assign(new Error(r.error), { status: 400 });
  const { url, job: j, scored } = r;
  let text = fs.readFileSync(file, 'utf8');
  const y = (v) => JSON.stringify(v ?? '');
  const setFm = (k, v) => { text = new RegExp(`^${k}: .*$`, 'm').test(text) ? text.replace(new RegExp(`^${k}: .*$`, 'm'), () => `${k}: ${v}`) : text.replace(/^---\n([\s\S]*?)\n---/, (m, body) => `---\n${body}\n${k}: ${v}\n---`); };
  setFm('company', y(j.company)); setFm('title', y(j.title)); setFm('location', y(j.location)); setFm('remote', j.remote ? 'true' : 'false');
  setFm('source', j.source); setFm('url', y(j.url || url)); setFm('score', scored.score); setFm('weights', fp(criteria));
  setFm('posted', y(j.posted ? String(j.posted).slice(0, 10) : '')); setFm('salary', y(j.salary)); setFm('salary_max', j.salaryMax || ''); setFm('pay_band', scored.payBand || 'unknown');
  setFm('department', y(j.department)); setFm('job_id', y(j.id));
  text = text.replace(/^# .*$/m, () => `# ${j.title} @ ${j.company}`);
  text = text.replace(/^\*\*\[Open posting\]\(.*?\)\*\*.*$/m, () => `**[Open posting](${j.url || url})** · ${j.location || 'location n/a'} · ${j.remote ? 'Remote' : 'On-site/Hybrid'} · score **${scored.score}**${j.salary ? ` · ${j.salary}` : ''}`);
  text = text.replace(/^## Why it matched\s*\n[\s\S]*?(?=^## )/m, () => `## Why it matched\n${scored.reasons.map((x) => `- ${x}`).join('\n')}\n\n`);
  text = text.replace(/^(## Status log\s*\n(?:- .*\n)*)/m, (m) => `${m}- ${isoDay()} — posting attached from ${url} (score ${scored.score}; was ${(m.match(/score (-?\d+)/) || [, '?'])[1]})\n`);
  const desc = (j.descriptionText || '').slice(0, criteria.maxDescriptionChars ?? 6000);
  const block = `## Job description\n> Source: ${j.source} · attached ${isoDay()}${(j.descriptionText || '').length > desc.length ? ' · truncated, open the posting for the full text' : ''}\n\n${desc}\n`;
  text = /^## Job description/m.test(text) ? text.replace(/^## Job description[\s\S]*$/m, () => block) : `${text.replace(/\n+$/, '')}\n\n${block}`;
  fs.writeFileSync(file, text);
  const seen = loadSeen();
  seen[j.id] = { path: file, firstSeen: new Date().toISOString(), company: j.company, title: j.title, companyKey: `link:${j.source}`, score: scored.score };
  saveSeen(seen);
  cache.key = '';
  return getJob(id);
}

/** Add postings from links the person pasted. One result per link, in order; a failure on one does not stop the rest. */
export async function importLinks(urls) {
  const list = [].concat(urls || []).flatMap((s) => String(s).split(/\s+/)).map((s) => s.trim()).filter(Boolean);
  if (!list.length) throw Object.assign(new Error('Give at least one link.'), { status: 400 });
  if (list.length > 25) throw Object.assign(new Error('At most 25 links at a time.'), { status: 400 });
  const { importLink } = await import('../../src/import-link.mjs');
  const criteria = loadCriteria();
  const out = [];
  for (const u of list) {
    const r = await importLink(u, { criteria });
    out.push(r.ok
      ? { url: r.url, link: r.job.url || r.url, ok: true, added: r.added, id: r.note ? path.basename(r.note, '.md') : r.existing ? path.basename(r.existing, '.md') : '', company: r.job.company, title: r.job.title, location: r.job.location, score: r.score, reason: r.reason || '', belowMin: !!r.belowMin }
      : { url: r.url || u, ok: false, error: r.error });
  }
  return out;
}

export function addCompany({ name, ats, slug, tier = 'B', notes = '' }) {
  if (!name || !ats || !slug) throw Object.assign(new Error('name, ats and slug are required'), { status: 400 });
  if (loadCompanies().some((c) => c.ats === ats.toLowerCase() && c.slug === slug)) throw Object.assign(new Error('that board is already in the table'), { status: 409 });
  const md = fs.readFileSync(P.companies, 'utf8').replace(/\n+$/, '');
  fs.writeFileSync(P.companies, `${md}\n| ${name} | ${ats.toLowerCase()} | ${slug} | ${tier} | | ${notes} |\n`);
  return loadCompanies();
}

// ---------- profile ----------
// The notes applications are written from. Profile, Positioning and Voice are the person's to edit; the resume
// note is synced from the resume file and is read here, not written.
const PROFILE_NOTES = [
  { key: 'profile', title: 'Profile', rel: 'Profile/Profile.md', editable: true, hint: 'Who you are: location, availability, links, the facts every application reads. The onboarding interview wrote it; you keep it current.' },
  { key: 'positioning', title: 'Positioning', rel: 'Profile/Positioning.md', editable: true, hint: 'How the story is told: which half leads for which posting, the evidence rule, what must never be claimed.' },
  { key: 'voice', title: 'Voice', rel: 'Profile/Voice.md', editable: true, hint: 'How you write. The cover-letter writer treats this note as binding; edit it here to change every letter after.' },
  { key: 'resume', title: 'Resume', rel: RESUME_NOTE, editable: false, hint: 'The resume of record, synced from your resume file. Edit the file and run `tekjobs resume sync`; this note is replaced on every sync.' },
];
export function profile() {
  const read = (rel) => safe(() => fs.readFileSync(path.join(VAULT, rel), 'utf8'), '');
  const notes = PROFILE_NOTES.map((n) => ({ ...n, path: path.join(VAULT, n.rel), markdown: read(n.rel), exists: fs.existsSync(path.join(VAULT, n.rel)) }));
  const resume = notes.find((n) => n.key === 'resume').markdown || [...LEGACY_RESUME_NOTES, 'Profile/Resume - Source.md'].map(read).find(Boolean) || '';
  return { profile: read('Profile/Profile.md'), positioning: read('Profile/Positioning.md'), voice: read('Profile/Voice.md'), resume, notes };
}
export function saveProfileNote(key, markdown) {
  const note = PROFILE_NOTES.find((n) => n.key === key);
  if (!note) throw Object.assign(new Error(`No profile note "${key}"`), { status: 404 });
  if (!note.editable) throw Object.assign(new Error(`${note.title} is synced from your resume file; edit the file and run tekjobs resume sync.`), { status: 400 });
  if (key === 'profile') return saveProfile(markdown);
  if (!markdown || markdown.trim().length < 40) throw Object.assign(new Error(`${note.title} is too short to save.`), { status: 400 });
  const file = path.join(VAULT, note.rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Same habit as saveProfile: the previous version is kept beside the note, once per day.
  if (fs.existsSync(file)) fs.copyFileSync(file, file.replace(/\.md$/, `.before-${isoDay()}.md`));
  fs.writeFileSync(file, markdown.replace(/^updated: .*$/m, `updated: ${isoDay()}`));
  return { saved: file };
}

// ---------- scan ----------
const scan = { running: false, startedAt: null, finishedAt: null, exitCode: null, output: [], criteria: '' };
export function scanStatus() { return { ...scan, output: scan.output.slice(-200) }; }
export function runScan(args = [], { criteria = '' } = {}) {
  if (scan.running) return scanStatus();
  if (criteria) getCriteriaPreset(criteria); // 404 now rather than a dead child process later
  scan.running = true; scan.startedAt = new Date().toISOString(); scan.finishedAt = null; scan.exitCode = null; scan.output = []; scan.criteria = criteria;
  const child = spawn(process.execPath, [path.join(ROOT, 'run.mjs'), ...args, ...(criteria ? ['--criteria', criteria] : [])], { cwd: ROOT, env: process.env });
  const push = (d) => { for (const l of String(d).split(/\r?\n/)) if (l.trim()) scan.output.push(l); };
  child.stdout.on('data', push); child.stderr.on('data', push);
  child.on('close', (code) => { scan.running = false; scan.exitCode = code; scan.finishedAt = new Date().toISOString(); cache.key = ''; });
  return scanStatus();
}
