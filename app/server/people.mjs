// People: the recruiters, hiring managers, referrals and interviewers a search accumulates. A dozen
// relationships, not a list. One note per person under People/, and a "## People" section on each job note
// that names who is on that thread. The mail check proposes people from the humans who wrote (never the
// no-reply senders), and they are written when the person confirms the email, like everything else from mail.
import fs from 'node:fs';
import path from 'node:path';
import { VAULT } from '../../src/config.mjs';
import { readFrontmatter } from '../../src/vault.mjs';
import * as store from './store.mjs';

export const PEOPLE_DIR = path.join(VAULT, 'People');
export const ROLES = ['recruiter', 'hiring-manager', 'interviewer', 'referral', 'other'];
const isoDay = () => new Date().toISOString().slice(0, 10);
const yaml = (v) => JSON.stringify(v ?? '');
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// ---------------- pure ----------------
/** A filename for a person: their name, cleaned; a company suffix keeps two Alex Kims apart. */
export function personId(name, company = '') {
  const clean = (s) => String(s || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim();
  const n = clean(name).slice(0, 60);
  return company ? `${n} (${clean(company).slice(0, 30)})` : n;
}

const AUTOMATED = /^(no-?reply|do-?not-?reply|donotreply|notifications?|noreply|mailer|jobs|careers|recruiting|talent|hiring|applications?|hr|system|updates?|alerts?|team|info|support|hello|candidates?)@|@(mail\.|em\.|e\.|notify\.|notifications?\.)/i;
const ATS_DOMAINS = /(greenhouse|ashbyhq|lever\.co|myworkdayjobs|workday|smartrecruiters|jobvite|icims|workablemail|workable|rippling|bamboohr|breezy|personio|teamtailor|eightfold|linkedin|indeed|glassdoor|wellfound|hired\.com|gem\.com|goodtime|calendly|modernloop)/i;

/** "Jane Doe <jane@x.com>" or "jane@x.com" into name and address. */
export function parseAddress(from = '') {
  const s = String(from).trim();
  const m = s.match(/^"?([^"<]*)"?\s*<([^>]+)>$/);
  const email = (m ? m[2] : s).trim().toLowerCase();
  let name = (m ? m[1] : '').trim();
  if (!name && email.includes('@')) name = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\d+/g, '').trim().replace(/\b\w/g, (c) => c.toUpperCase());
  return { name, email: email.includes('@') ? email : '' };
}

/**
 * The person behind a mail item, or null when a machine sent it. A human sender on an application thread is
 * almost always the recruiter or coordinator; the role can be corrected on the note.
 */
export function fromMail(item = {}) {
  const { name: fromName, email } = parseAddress(item.from);
  if (!email || AUTOMATED.test(email) || ATS_DOMAINS.test(email.split('@')[1] || '')) return null;
  const name = String(item.fromName || '').trim() || fromName;
  if (!name || name.includes('@')) return null;
  return { name, email, role: 'recruiter', company: item.company || '' };
}

// The People-line parser lives in store.mjs, which Today reads through; it is the same function here.
export { parsePeopleLines } from './store.mjs';

const wikiJobs = (section = '') => [...String(section).matchAll(/\[\[Jobs\/([^\]|]+)(?:\|[^\]]*)?\]\]\s*(?:·\s*([^\n]*))?/g)].map((m) => ({ id: m[1].trim(), role: (m[2] || '').trim() }));

// ---------------- notes ----------------
const file = (id) => path.join(PEOPLE_DIR, `${path.basename(String(id)).replace(/\.md$/, '')}.md`);
const section = (text, h) => { const m = text.match(new RegExp(`^## ${h}\\s*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm')); return m ? m[1].trim() : ''; };

function ensureSection(text, heading) {
  if (new RegExp(`^## ${heading}[ \\t]*$`, 'm').test(text)) return text;
  // On a job note the section sits above the posting, with the person's other material.
  if (/^## Job description[ \t]*$/m.test(text)) return text.replace(/^## Job description[ \t]*$/m, () => `## ${heading}\n\n## Job description`);
  return `${text.trimEnd()}\n\n## ${heading}\n`;
}

function row(fm, text) {
  const jobs = new Map(store.listJobs().map((j) => [j.id, j]));
  const threads = wikiJobs(section(text, 'Threads')).map((t) => { const j = jobs.get(t.id); return { id: t.id, role: t.role, title: j ? `${j.company} - ${j.title}` : t.id, status: j ? j.status : '' }; });
  return {
    id: fm._name, name: fm.name || fm._name, role: fm.role || 'other', company: fm.company || '', email: fm.email || '', links: fm.links || '',
    created: fm.created || '', lastContact: fm.last_contact || '', threads, live: threads.filter((t) => ['applying', 'ready', 'applied', 'interviewing', 'offer'].includes(t.status)).length,
    path: fm._file, obsidianUrl: `obsidian://open?path=${encodeURIComponent(fm._file)}`,
  };
}

export function listPeople() {
  if (!fs.existsSync(PEOPLE_DIR)) return [];
  return fs.readdirSync(PEOPLE_DIR).filter((f) => f.endsWith('.md')).map((f) => {
    const p = path.join(PEOPLE_DIR, f);
    const fm = readFrontmatter(p);
    return fm ? row(fm, fs.readFileSync(p, 'utf8')) : null;
  }).filter(Boolean).sort((a, b) => (b.lastContact || '').localeCompare(a.lastContact || '') || a.name.localeCompare(b.name));
}

export function getPerson(id) {
  const p = file(id);
  if (!fs.existsSync(p)) throw Object.assign(new Error(`No person named "${id}"`), { status: 404 });
  const text = fs.readFileSync(p, 'utf8');
  return { ...row(readFrontmatter(p), text), about: section(text, 'About'), log: section(text, 'Log') };
}

/** The same person again: by email first, then by name at the same company, then by name alone. */
export function findPerson({ email = '', name = '', company = '' } = {}) {
  const all = listPeople();
  const e = String(email).toLowerCase().trim();
  if (e) { const hit = all.find((p) => p.email.toLowerCase() === e); if (hit) return hit; }
  const n = norm(name);
  if (!n) return null;
  return all.find((p) => norm(p.name) === n && (!company || norm(p.company) === norm(company))) || all.find((p) => norm(p.name) === n) || null;
}

export function createPerson({ name, role = 'other', company = '', email = '', links = '', about = '' } = {}) {
  if (!name || !String(name).trim()) throw Object.assign(new Error('A person needs a name.'), { status: 400 });
  if (!ROLES.includes(role)) throw Object.assign(new Error(`role must be one of ${ROLES.join(', ')}`), { status: 400 });
  const existing = findPerson({ email, name, company });
  if (existing) return getPerson(existing.id);
  fs.mkdirSync(PEOPLE_DIR, { recursive: true });
  let id = personId(name, company), n = 2;
  while (fs.existsSync(file(id))) id = `${personId(name, company)} ${n++}`;
  const fm = ['---', 'type: person', `name: ${yaml(String(name).trim())}`, `role: ${role}`, `company: ${yaml(company)}`, `email: ${yaml(email)}`, `links: ${yaml(links)}`, `created: ${isoDay()}`, 'last_contact: ', '---'].join('\n');
  const body = `\n# ${String(name).trim()}\n\n## About\n${about ? about.trim() + '\n' : ''}\n## Threads\n\n## Log\n`;
  fs.writeFileSync(file(id), fm + '\n' + body);
  return getPerson(id);
}

/** Put a person on a job note and the job on the person's Threads. Idempotent. */
export function attachPerson(jobId, personId_, { role = '', context = '' } = {}) {
  const person = getPerson(personId_);
  const job = store.getJob(jobId);
  const r = ROLES.includes(role) ? role : person.role;
  let text = fs.readFileSync(job.path, 'utf8');
  if (!text.includes(`[[People/${person.id}`)) {
    const line = `- [[People/${person.id}|${person.name}]]${r ? ` · ${r}` : ''}${person.email ? ` · ${person.email}` : ''}${context ? ` · ${String(context).replace(/\r?\n/g, ' ').trim()}` : ''}`;
    text = store.appendUnderHeading(ensureSection(text, 'People'), 'People', line);
    fs.writeFileSync(job.path, text);
    store.cacheClear();
  }
  let ptext = fs.readFileSync(person.path, 'utf8');
  if (!ptext.includes(`[[Jobs/${job.id}`)) {
    ptext = store.appendUnderHeading(ptext, 'Threads', `- [[Jobs/${job.id}|${job.company} - ${job.title}]]${r ? ` · ${r}` : ''}`);
    fs.writeFileSync(person.path, ptext);
  }
  return store.getJob(jobId);
}

/** A dated line under the person's Log; last_contact moves forward, never back. */
export function logContact(personId_, { date = '', via = 'app', text = '' } = {}) {
  const person = getPerson(personId_);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : isoDay();
  let ptext = fs.readFileSync(person.path, 'utf8');
  if (String(text).trim()) ptext = store.appendUnderHeading(ptext, 'Log', `- ${day} (${via}): ${String(text).replace(/\r?\n/g, ' ').trim()}`);
  if (!person.lastContact || day > person.lastContact) ptext = store.replaceFrontmatterLine(ptext, 'last_contact', day);
  fs.writeFileSync(person.path, ptext);
  return getPerson(person.id);
}

/** The people on one job note, as the note lists them. */
export function peopleOf(jobId) {
  return store.parsePeopleLines(store.getJob(jobId).sections.people);
}

/**
 * From a confirmed mail item: the human who wrote becomes a person (or is recognised), goes on the note's
 * People, and gets the email on their Log. Called by the mail check after the person confirms; nothing here
 * runs on its own.
 */
export function recordFromMail(jobId, item, link) {
  const who = fromMail(item);
  if (!who) return null;
  const person = createPerson({ name: who.name, role: who.role, company: who.company, email: who.email, about: `Wrote about ${item.role || 'an application'} at ${item.company}.` });
  attachPerson(jobId, person.id, { role: person.role, context: `${item.kind}, ${item.date || 'undated'}` });
  logContact(person.id, { date: item.date, via: 'mail', text: `${item.kind}: ${item.gist}${link ? ` [message](${link})` : ''}` });
  return person.id;
}
