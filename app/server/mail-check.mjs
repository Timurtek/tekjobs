// The response loop: what the mailbox says about the applications, reconciled with the notes.
//
// The same local CLI that writes the letters reads the mail, through the Gmail connector the person has
// already attached to it. The run is boxed: only the three Gmail read tools are allowed and every write tool
// (send, reply, draft, label, trash, forward) plus Bash/Write/Edit are denied by name, so a run can read and
// nothing else, whatever the model decides. The model's job is extraction into a fixed JSON shape; matching
// those entries to notes, and everything that changes a note, is deterministic code here, and nothing changes
// until a person confirms an item. Applied, interviewing and offer stay human statuses; so does rejected,
// because a wrong "rejected" is the one a person would mind most.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, loadCriteria } from '../../src/config.mjs';
import { writeJobNote } from '../../src/vault.mjs';
import { scoreJob } from '../../src/score.mjs';
import { htmlToText } from '../../src/sources.mjs';
import * as store from './store.mjs';
import { runLLM, runnerConfig } from './cover-letter.mjs';

const FILE = path.join(DATA_DIR, 'mail-check.json');
const READ_TOOLS = ['mcp__claude_ai_Gmail__search_threads', 'mcp__claude_ai_Gmail__get_thread', 'mcp__claude_ai_Gmail__get_message'];
const DENY_TOOLS = ['send_message', 'reply', 'forward', 'create_draft', 'update_draft', 'send_draft', 'delete_draft', 'trash_message', 'trash_thread', 'untrash_message', 'untrash_thread', 'label_message', 'label_thread', 'unlabel_message', 'unlabel_thread', 'update_message_labels', 'create_label', 'update_label', 'delete_label', 'mark_message_spam', 'mark_thread_spam', 'unmark_message_spam', 'unmark_thread_spam', 'apply_sensitive_message_label', 'apply_sensitive_thread_label']
  .map((t) => `mcp__claude_ai_Gmail__${t}`).concat(['Bash', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'WebFetch', 'WebSearch']);
export const KINDS = ['confirmation', 'rejection', 'advance', 'scheduling', 'info-request', 'other'];
const SEARCHES = [
  'from:greenhouse.io', 'from:ashbyhq.com', 'from:lever.co OR from:hire.lever.co', 'from:myworkdayjobs.com OR from:workday.com', 'from:smartrecruiters.com OR from:jobvite.com OR from:icims.com OR from:workablemail.com OR from:rippling.com',
  'subject:("your application" OR "thank you for applying" OR "thanks for applying" OR "application received" OR "application update" OR "next steps" OR "not moving forward" OR interview)',
];
const gmailLink = (id) => `https://mail.google.com/mail/u/0/#all/${id}`;

function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { lastRun: null, sinceDays: null, items: [] }; } }
function persist(d) { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); }

/** The extraction prompt. The companies list is a hint for recognition, not a filter: mail about others is still reported. */
export function prompt({ sinceDays = 21, companies = [] } = {}) {
  return `You are checking a job seeker's mailbox for updates about job applications. Use ONLY the Gmail search and read tools. Do not send, reply, draft, label, forward, trash or modify anything.

Run these searches, each with newer_than:${sinceDays}d appended, then stop:
${SEARCHES.map((s, i) => `${i + 1}. ${s} newer_than:${sinceDays}d`).join('\n')}

Search results already carry subject, sender, date and a snippet. Decide from those. Read a thread only when the subject and snippet do not say whether the message is a confirmation of receipt, a rejection, or an advance (an interview, a screen, a scheduling request). Do not read threads that are plainly confirmations.

Report every message that is about one of the person's job applications: confirmations of receipt, rejections, invitations to interview or to schedule, requests to complete or add to an application. Ignore job alerts, newsletters, recruiter cold outreach, and anything not tied to an application the person made.${companies.length ? `

The person's own records show applications at these companies (others may exist): ${companies.join(', ')}.` : ''}

Output ONLY a JSON array, no prose, no code fence, one object per message:
{"company": "company name as the email gives it", "role": "role title if stated, else empty string", "kind": "confirmation|rejection|advance|scheduling|info-request|other", "date": "YYYY-MM-DD", "gist": "one plain sentence", "from": "sender address", "messageId": "gmail message id", "subject": "subject line"}

If nothing matches, output [].`;
}

/** The model's text into clean entries, or an error that says what came back. */
export function parseOutput(text) {
  const s = String(text || '');
  const a = s.indexOf('['), b = s.lastIndexOf(']');
  if (a < 0 || b < a) throw new Error(`The runner returned no JSON array. It said: ${s.slice(0, 200).replace(/\s+/g, ' ')}`);
  let arr; try { arr = JSON.parse(s.slice(a, b + 1)); } catch (e) { throw new Error(`The runner's JSON did not parse: ${e.message}`); }
  if (!Array.isArray(arr)) throw new Error('The runner returned JSON that is not an array.');
  return arr.filter((m) => m && typeof m === 'object' && m.company && m.messageId).map((m) => ({
    company: String(m.company).trim(), role: String(m.role || '').trim(), kind: KINDS.includes(m.kind) ? m.kind : 'other',
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(m.date || '')) ? m.date : '', gist: String(m.gist || '').trim().slice(0, 300),
    from: String(m.from || '').trim(), messageId: String(m.messageId).trim(), subject: String(m.subject || '').trim().slice(0, 200),
  }));
}

const norm = (s) => String(s || '').toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '').replace(/\b(inc|llc|ltd|corp|co|the)\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const APPLIED_ISH = new Set(['applying', 'ready', 'applied', 'interviewing', 'offer', 'rejected']);
const OPEN_ISH = new Set(['new', 'reviewing', 'applying', 'ready']);

/** What confirming an entry would do to its note. Pure, so it can be tested. */
export function suggestionFor(kind, noteStatus, date) {
  if (!noteStatus) return { action: 'create', status: kind === 'rejection' ? 'rejected' : kind === 'advance' || kind === 'scheduling' ? 'interviewing' : 'applied', appliedOn: date };
  if (kind === 'confirmation') return OPEN_ISH.has(noteStatus) ? { action: 'status', status: 'applied', appliedOn: date } : { action: 'record', appliedOn: date };
  if (kind === 'rejection') return noteStatus === 'rejected' ? { action: 'record' } : { action: 'status', status: 'rejected' };
  if (kind === 'advance' || kind === 'scheduling') return ['interviewing', 'offer'].includes(noteStatus) ? { action: 'record' } : { action: 'status', status: 'interviewing' };
  return { action: 'record' };
}

/**
 * Match mail entries to notes: same company by name, the exact role when the title matches, otherwise the
 * note that is furthest along, with the other candidates listed so a person can pick. Pure.
 */
export function reconcile(mails, notes) {
  const byCompany = new Map();
  for (const n of notes) { const k = norm(n.company); if (!k) continue; if (!byCompany.has(k)) byCompany.set(k, []); byCompany.get(k).push(n); }
  const rank = (n) => (APPLIED_ISH.has(n.status) ? 2 : n.status === 'reviewing' ? 1 : 0);
  return mails.map((m) => {
    const key = norm(m.company);
    let cands = byCompany.get(key) || [];
    if (!cands.length && key) cands = [...byCompany.entries()].filter(([k]) => k.startsWith(key + ' ') || key.startsWith(k + ' ')).flatMap(([, v]) => v);
    const exact = m.role ? cands.find((n) => norm(n.title) === norm(m.role)) : null;
    const byRank = [...cands].sort((a, b) => rank(b) - rank(a) || (b.score || 0) - (a.score || 0));
    // An email that names a role the vault does not have is a different application, not the note that
    // happens to share the company: default to a new note and offer the company's notes as a pick. (Learned
    // on the first real run, when a Staff Product Designer confirmation landed on an Engineering Manager note.)
    const otherRole = !exact && m.role && cands.length > 0;
    const best = exact || (otherRole ? null : byRank[0] || null);
    const match = exact ? 'exact' : otherRole ? 'company-other-role' : best ? 'company' : 'none';
    return {
      id: m.messageId, ...m, match,
      noteId: best ? best.id : '', noteTitle: best ? best.title : '', noteStatus: best ? best.status : '',
      candidates: byRank.slice(0, 6).map((n) => ({ id: n.id, title: n.title, status: n.status })),
      suggestion: suggestionFor(m.kind, best ? best.status : '', m.date),
      state: 'pending',
    };
  });
}

// ---------------- grouping ----------------
// One application produces several emails (a confirmation, then scheduling mail, then a decision), and the
// mailbox holds each one. A person decides once per application, so pending items are grouped by company and
// role; the strongest kind speaks for the group and the rest are recorded with it when it is confirmed.
const STRENGTH = { rejection: 5, advance: 4, scheduling: 4, 'info-request': 2, confirmation: 1, other: 0 };
export function groupItems(items) {
  const groups = new Map();
  for (const i of items.filter((x) => x.state === 'pending')) {
    const key = `${norm(i.company)}|${norm(i.role)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  }
  return [...groups.values()].map((members) => {
    const sorted = [...members].sort((a, b) => (STRENGTH[b.kind] - STRENGTH[a.kind]) || (b.date || '').localeCompare(a.date || ''));
    const rep = sorted[0];
    return {
      id: rep.id, ids: sorted.map((m) => m.id), count: members.length,
      company: rep.company, role: rep.role || sorted.find((m) => m.role)?.role || '',
      kind: rep.kind, kinds: [...new Set(sorted.map((m) => m.kind))], date: sorted.map((m) => m.date).sort().pop() || '',
      first: sorted.map((m) => m.date).filter(Boolean).sort()[0] || '',
      gist: rep.gist, subject: rep.subject, from: rep.from,
      match: rep.match, noteId: rep.noteId, noteTitle: rep.noteTitle, noteStatus: rep.noteStatus, candidates: rep.candidates, suggestion: rep.suggestion,
    };
  }).sort((a, b) => (STRENGTH[b.kind] - STRENGTH[a.kind]) || b.date.localeCompare(a.date));
}

// ---------------- running ----------------
const run = { running: false, startedAt: null, finishedAt: null, error: '', errorKind: '', sinceDays: null };
export function items() {
  const d = load();
  const all = d.items || [];
  return { ...run, runner: runnerConfig().command, lastRun: d.lastRun, lastSinceDays: d.sinceDays, items: all, groups: groupItems(all) };
}
export function start({ sinceDays } = {}) {
  if (run.running) return items();
  const d = load();
  // Default window: since the last check plus a day of overlap, or three weeks the first time.
  const days = Number(sinceDays) || (d.lastRun ? Math.max(2, Math.ceil((Date.now() - Date.parse(d.lastRun)) / 864e5) + 1) : 21);
  Object.assign(run, { running: true, startedAt: new Date().toISOString(), finishedAt: null, error: '', errorKind: '', sinceDays: days });
  const notes = store.listJobs();
  const companies = [...new Set(notes.filter((n) => APPLIED_ISH.has(n.status)).map((n) => n.company))].sort();
  runLLM(prompt({ sinceDays: days, companies }), { timeoutMs: 15 * 60 * 1000, extraArgs: ['--allowedTools', ...READ_TOOLS, '--disallowedTools', ...DENY_TOOLS] })
    .then((text) => {
      const fresh = reconcile(parseOutput(text), store.listJobs());
      const cur = load();
      const known = new Map((cur.items || []).map((i) => [i.id, i]));
      // A message already confirmed or dismissed keeps that state; everything else is re-matched against today's notes.
      const merged = fresh.map((i) => { const k = known.get(i.id); return k && k.state !== 'pending' ? { ...k, ...i, state: k.state, resolved: k.resolved } : i; });
      for (const k of known.values()) if (!merged.some((i) => i.id === k.id)) merged.push(k);   // older windows stay
      merged.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      persist({ lastRun: new Date().toISOString(), sinceDays: days, items: merged });
      Object.assign(run, { running: false, finishedAt: new Date().toISOString() });
    })
    .catch((e) => Object.assign(run, { running: false, finishedAt: new Date().toISOString(), error: e.message, errorKind: e.kind || 'failed' }));
  return items();
}

// ---------------- confirming ----------------
const mailLine = (i) => `Mail, ${i.date || 'undated'} (${i.kind}): ${i.gist} [message](${gmailLink(i.messageId)})`;

function appliedOnEmpty(id) {
  try { return /^- \*\*Applied on:\*\*\s*$/m.test(fs.readFileSync(store.getJob(id).path, 'utf8')); } catch { return false; }
}

/**
 * Do what the group's strongest email suggests, to the note the person chose (or the matched one), record
 * every email in the group on that note, and mark them all confirmed.
 */
export function confirm(id, { noteId } = {}) {
  const d = load();
  const group = groupItems(d.items || []).find((g) => g.ids.includes(id));
  const item = (d.items || []).find((i) => i.id === (group ? group.id : id));
  if (!item) throw Object.assign(new Error(`No mail item ${id}`), { status: 404 });
  const members = (d.items || []).filter((i) => (group ? group.ids : [id]).includes(i.id));
  // The earliest confirmation in the group is the application date; the strongest email decides the status.
  const appliedOn = members.filter((m) => m.kind === 'confirmation' && m.date).map((m) => m.date).sort()[0] || item.date;
  let target = noteId || item.noteId;
  const s = target ? suggestionFor(item.kind, store.getJob(target).status, appliedOn) : suggestionFor(item.kind, '', appliedOn);
  if (!target) {
    if (s.action !== 'create') throw Object.assign(new Error('This entry matched no note; pick one or create one.'), { status: 400 });
    const criteria = loadCriteria();
    const job = { id: `mail:${item.messageId}`, source: 'mail', company: item.company, title: item.role || 'Role not stated in the email', url: gmailLink(item.messageId), location: '', remote: false, posted: item.date || null, salary: '', department: '', employmentType: '',
      descriptionHtml: `<p>Created from an application email (${item.kind}, ${item.date || 'undated'}): ${item.gist}</p><p>Subject: ${item.subject}</p><p>From: ${item.from}</p>`, foundVia: 'created from an application email', addedBy: 'mail' };
    job.descriptionText = htmlToText(job.descriptionHtml);
    const file = writeJobNote(job, scoreJob(job, criteria), criteria);
    target = path.basename(file, '.md');
    store.cacheClear?.();
  }
  if (s.action === 'status' || s.action === 'create') store.setStatus(target, s.status, 'app');
  if (appliedOn && members.some((m) => m.kind === 'confirmation') && appliedOnEmpty(target)) store.saveApplicationDraft(target, { field: 'Applied on', value: appliedOn });
  // Oldest first, so the note's Notes read in the order the mail arrived.
  for (const m of [...members].sort((a, b) => (a.date || '').localeCompare(b.date || ''))) store.addNote(target, mailLine(m), 'app');
  const at = new Date().toISOString();
  for (const m of members) { m.state = 'confirmed'; m.noteId = target; m.resolved = { at, action: s.action, status: s.status || '' }; }
  persist(d);
  return items();
}
/**
 * The safe set in one go: confirmations whose note matched by exact title. Each one either records the mail on
 * a note already marked applied or marks a still-open note applied as of the mail's date. Rejections, interview
 * signals, company-only matches and creates are left for one-at-a-time, since those deserve a look.
 */
export function safeGroups() {
  return groupItems(load().items || []).filter((g) => g.kind === 'confirmation' && g.match === 'exact' && g.noteId);
}
export function confirmSafe() {
  const done = [];
  for (const g of safeGroups()) { try { confirm(g.id); done.push(g.id); } catch { /* the next group still gets its turn */ } }
  return { confirmed: done.length, ...items() };
}
export function dismiss(id) {
  const d = load();
  const group = groupItems(d.items || []).find((g) => g.ids.includes(id));
  const members = (d.items || []).filter((i) => (group ? group.ids : [id]).includes(i.id));
  if (!members.length) throw Object.assign(new Error(`No mail item ${id}`), { status: 404 });
  const at = new Date().toISOString();
  for (const m of members) { m.state = 'dismissed'; m.resolved = { at, action: 'dismissed' }; }
  persist(d);
  return items();
}
