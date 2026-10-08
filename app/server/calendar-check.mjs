// Calendar check: a read-only pass over the person's Google Calendar for interviews and other events about jobs
// on their board, through the same local CLI that writes letters and reads mail, with its Google Calendar
// connector. The run is boxed: only the connector's read tools are allowed and every write tool (create, update,
// delete, respond) plus Bash/Write/Edit are denied by name, so a run can read a calendar and nothing else.
//
// The model finds and extracts; everything after that is ordinary code. Each event is matched to a job note by
// company, then shown as a proposal. Confirming puts the event's time into the note's "Interview on" field (so
// the Calendar page and the .ics feed carry it), moves a note that is not yet interviewing to interviewing, and
// records the event on the note. Nothing is ever written to the calendar.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../../scraper/config.mjs';
import { sameCompany } from '../../scraper/linkedin.mjs';
import * as store from './store.mjs';
import { runLLM, runnerConfig } from './cover-letter.mjs';

const FILE = path.join(DATA_DIR, 'calendar-check.json');
const CAL = 'mcp__claude_ai_Google_Calendar__';
export const READ_TOOLS = ['list_calendars', 'list_events', 'search_events', 'get_event'].map((t) => `${CAL}${t}`);
export const DENY_TOOLS = ['create_event', 'update_event', 'delete_event', 'respond_to_event', 'suggest_time'].map((t) => `${CAL}${t}`)
  .concat(['Bash', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'WebFetch', 'WebSearch']);
export const KINDS = ['interview', 'screen', 'onsite', 'offer-call', 'recruiter-call', 'deadline', 'other'];
const ACTIVE = new Set(['reviewing', 'applying', 'ready', 'applied', 'interviewing', 'offer']);

function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { lastRun: null, days: null, items: [] }; } }
function persist(d) { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); }

/** The extraction prompt. The companies are a hint for recognition, not a filter: an interview at a company with no note is still reported. */
export function prompt({ days = 21, back = 7, companies = [] } = {}) {
  return `You are checking a job seeker's Google Calendar for events about their job search. Use ONLY the Google Calendar list, search and get tools. Do not create, update, delete or respond to anything.

Look at every event from ${back} days ago to ${days} days ahead, on every calendar list_calendars returns. Report an event when its title, description, location or attendees show it is about a job application: an interview, a phone or video screen, an onsite, a take-home review, a recruiter or hiring-manager call, an offer call, or a deadline for an application. Skip everything else (meetings at the person's current job, personal events, reminders that name no company).

Decide the company from the title, the description, the organiser's or attendees' email domains, or the meeting link. Use the exact start time the event has.

Output ONLY a JSON array, no prose, no code fence, one object per event:
{"company": "company name", "role": "role title if the event or its description names one, else empty string", "kind": "${KINDS.join('|')}", "start": "YYYY-MM-DD HH:MM in the person's own time zone", "end": "YYYY-MM-DD HH:MM or empty", "summary": "the event title", "gist": "one plain sentence on what it is", "with": "the other people on it by name, comma separated, or empty", "location": "the meeting link or place, or empty", "eventId": "the event id", "calendarId": "the calendar's id (its email-like id) if the tool gives it, else empty", "calendar": "the calendar's name", "link": "the event's htmlLink (its calendar.google.com address) if the tool gives it, else empty"}

If nothing matches, output [].${companies.length ? `

The person's own records show applications in flight at these companies (others may exist): ${companies.join(', ')}.` : ''}`;
}

const WHEN = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}):(\d{2}))?/;
const when = (s) => { const m = String(s || '').trim().match(WHEN); return m ? `${m[1]}${m[2] ? ` ${m[2].padStart(2, '0')}:${m[3]}` : ''}` : ''; };

/** The model's text into clean entries, or an error that says what came back. */
export function parseOutput(text) {
  const s = String(text || '');
  const a = s.indexOf('['), b = s.lastIndexOf(']');
  if (a < 0 || b < a) throw new Error(`The runner returned no JSON array. It said: ${s.slice(0, 200).replace(/\s+/g, ' ')}`);
  let arr; try { arr = JSON.parse(s.slice(a, b + 1)); } catch (e) { throw new Error(`The runner's JSON did not parse: ${e.message}`); }
  if (!Array.isArray(arr)) throw new Error('The runner returned JSON that is not an array.');
  return arr.filter((m) => m && typeof m === 'object' && m.company && when(m.start)).map((m) => ({
    id: String(m.eventId || `${m.company}|${m.start}`).trim(), company: String(m.company).trim(), role: String(m.role || '').trim(),
    kind: KINDS.includes(m.kind) ? m.kind : 'other', start: when(m.start), end: when(m.end), summary: String(m.summary || '').trim().slice(0, 160),
    gist: String(m.gist || '').trim().slice(0, 300), with: String(m.with || '').trim().slice(0, 200), location: String(m.location || '').trim().slice(0, 300), calendar: String(m.calendar || '').trim().slice(0, 80),
    calendarId: String(m.calendarId || '').trim().slice(0, 160), link: /^https:\/\/(calendar\.google\.com|www\.google\.com\/calendar)\//i.test(String(m.link || '').trim()) ? String(m.link).trim() : '',
  }));
}

const INTERVIEWISH = new Set(['interview', 'screen', 'onsite', 'offer-call']);

/** What confirming an event would do to the note it matched. */
export function suggestionFor(kind, noteStatus) {
  if (!noteStatus) return { action: 'none', text: 'No note at this company; the event is noted here only.' };
  if (kind === 'deadline') return { action: 'deadline', text: 'Puts the date in the note\'s Deadline field.' };
  if (!INTERVIEWISH.has(kind)) return { action: 'record', text: 'Records the call on the note.' };
  if (['interviewing', 'offer'].includes(noteStatus)) return { action: 'record', text: 'Records the time in the note\'s Interview on field.' };
  return { action: 'status', status: 'interviewing', text: 'Moves the note to interviewing and records the time in Interview on.' };
}

/** Each event matched to the notes: the one note at that company in flight, or a pick among several. */
export function reconcile(events, notes) {
  const rank = (n) => (n.status === 'interviewing' || n.status === 'offer' ? 3 : ACTIVE.has(n.status) ? 2 : n.status === 'reviewing' ? 1 : 0);
  return events.map((e) => {
    const cands = notes.filter((n) => sameCompany(n.company, e.company)).sort((a, b) => rank(b) - rank(a) || (b.score || 0) - (a.score || 0));
    const byRole = e.role ? cands.find((n) => n.title.toLowerCase().includes(e.role.toLowerCase()) || e.role.toLowerCase().includes(n.title.toLowerCase())) : null;
    const note = byRole || (cands.length === 1 || (cands[0] && rank(cands[0]) >= 2) ? cands[0] : null);
    return {
      ...e, state: 'pending', match: byRole ? 'role' : note ? 'company' : 'none',
      noteId: note?.id || '', noteTitle: note?.title || '', noteStatus: note?.status || '',
      candidates: cands.slice(0, 6).map((n) => ({ id: n.id, title: n.title, status: n.status })),
      suggestion: suggestionFor(e.kind, note?.status || ''),
    };
  }).sort((a, b) => a.start.localeCompare(b.start));
}

// ---------------- running ----------------
const run = { running: false, startedAt: null, finishedAt: null, error: '', errorKind: '', days: null, lastOutput: '' };
/**
 * Where the event opens in Google Calendar: its own htmlLink when the connector gave one; else the edit address
 * built from the event and calendar ids the way Google encodes it; else the day it is on.
 */
export function eventLink(i) {
  if (i.link) return i.link;
  if (i.id && i.calendarId && !/\|/.test(i.id)) return `https://calendar.google.com/calendar/u/0/r/eventedit/${Buffer.from(`${i.id} ${i.calendarId}`).toString('base64').replace(/=+$/, '')}`;
  const [y, m, d] = String(i.start || '').slice(0, 10).split('-');
  return y && m && d ? `https://calendar.google.com/calendar/u/0/r/day/${y}/${Number(m)}/${Number(d)}` : 'https://calendar.google.com/';
}
export function items() {
  const d = load();
  const all = (d.items || []).map((i) => ({ ...i, link: eventLink(i) }));
  return { ...run, runner: runnerConfig().command, lastRun: d.lastRun, lastDays: d.days, items: all, pending: all.filter((i) => i.state === 'pending') };
}
export function start({ days } = {}) {
  if (run.running) return items();
  const ahead = Number(days) || 21;
  Object.assign(run, { running: true, startedAt: new Date().toISOString(), finishedAt: null, error: '', errorKind: '', days: ahead });
  const notes = store.listJobs();
  const companies = [...new Set(notes.filter((n) => ACTIVE.has(n.status)).map((n) => n.company))].sort();
  runLLM(prompt({ days: ahead, companies }), { timeoutMs: 15 * 60 * 1000, extraArgs: ['--allowedTools', ...READ_TOOLS, '--disallowedTools', ...DENY_TOOLS] })
    .then((text) => {
      run.lastOutput = String(text).slice(0, 4000);
      const fresh = reconcile(parseOutput(text), store.listJobs());
      const cur = load();
      const known = new Map((cur.items || []).map((i) => [i.id, i]));
      // An event already confirmed or dismissed keeps that state; a pending one is re-matched against today's notes.
      const merged = fresh.map((i) => { const k = known.get(i.id); return k && k.state !== 'pending' ? { ...k, ...i, state: k.state, resolved: k.resolved } : i; });
      for (const k of known.values()) if (!merged.some((i) => i.id === k.id)) merged.push(k);
      merged.sort((a, b) => (a.start || '').localeCompare(b.start || ''));
      persist({ lastRun: new Date().toISOString(), days: ahead, items: merged });
      Object.assign(run, { running: false, finishedAt: new Date().toISOString() });
    })
    .catch((e) => Object.assign(run, { running: false, finishedAt: new Date().toISOString(), error: e.message, errorKind: e.kind || 'failed' }));
  return items();
}

// ---------------- confirming ----------------
const fieldEmpty = (id, field) => { try { return !new RegExp(`^- \\*\\*${field}:\\*\\*\\s*\\S`, 'm').test(fs.readFileSync(store.getJob(id).path, 'utf8')); } catch { return false; } };
const line = (i) => `Calendar, ${i.start}${i.end ? ` to ${i.end.slice(-5)}` : ''} (${i.kind}): ${i.summary || i.gist}${i.with ? `, with ${i.with}` : ''}${i.location ? ` [${i.location}]` : ''}`;

/** The person confirms one event, optionally choosing the note. Writes the time, the status where it applies, and a line on the note. */
export function confirm(id, { noteId } = {}) {
  const d = load();
  const item = (d.items || []).find((i) => i.id === id);
  if (!item) throw Object.assign(new Error(`No calendar item ${id}`), { status: 404 });
  const target = noteId || item.noteId;
  const s = target ? suggestionFor(item.kind, store.getJob(target).status) : suggestionFor(item.kind, '');
  if (target) {
    if (s.action === 'status') store.setStatus(target, s.status, 'app');
    if (s.action === 'deadline') { if (fieldEmpty(target, 'Deadline')) store.saveApplicationDraft(target, { field: 'Deadline', value: item.start.slice(0, 10) }); }
    else if (INTERVIEWISH.has(item.kind)) {
      // The latest confirmed interview is the one on the calendar; an earlier round the person wrote by hand gives way to it.
      const current = (() => { try { return (fs.readFileSync(store.getJob(target).path, 'utf8').match(/^- \*\*Interview on:\*\*\s*(\S.*)$/m) || [])[1] || ''; } catch { return ''; } })();
      if (!current || item.start > current) store.saveApplicationDraft(target, { field: 'Interview on', value: item.start });
    }
    store.addNote(target, line(item), 'app');
  }
  const at = new Date().toISOString();
  item.state = 'confirmed'; item.noteId = target || ''; item.resolved = { at, action: s.action, status: s.status || '' };
  persist(d);
  return items();
}
export function dismiss(id) {
  const d = load();
  const item = (d.items || []).find((i) => i.id === id);
  if (!item) throw Object.assign(new Error(`No calendar item ${id}`), { status: 404 });
  item.state = 'dismissed'; item.resolved = { at: new Date().toISOString(), action: 'dismissed' };
  persist(d);
  return items();
}
