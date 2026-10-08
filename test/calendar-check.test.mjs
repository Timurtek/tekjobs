// The Google Calendar check: the model's text becomes clean events, each event is matched to a note by company
// and role, confirming writes the time into Interview on and moves the note, dismissing leaves everything alone.
// The runner is never called here; the parse and the writes are the parts that are ours.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'tekjobs-calcheck-'));
fs.cpSync(path.join(ROOT, 'samples', 'vault'), vault, { recursive: true });
process.env.TEKJOBS_PROFILE = vault;
const { DATA_DIR } = await import('../scraper/config.mjs');
const store = await import('../app/server/store.mjs');
const cc = await import('../app/server/calendar-check.mjs');

const plus = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

test('the tool lists allow only the connector\'s read tools and deny every write by name', () => {
  assert.deepEqual(cc.READ_TOOLS, ['list_calendars', 'list_events', 'search_events', 'get_event'].map((t) => `mcp__claude_ai_Google_Calendar__${t}`));
  for (const w of ['create_event', 'update_event', 'delete_event', 'respond_to_event']) assert.ok(cc.DENY_TOOLS.includes(`mcp__claude_ai_Google_Calendar__${w}`), `${w} denied`);
  assert.ok(cc.DENY_TOOLS.includes('Bash'));
  assert.match(cc.prompt({ days: 14, companies: ['Northwind Labs'] }), /Do not create, update, delete or respond/);
  assert.match(cc.prompt({ days: 14, companies: ['Northwind Labs'] }), /Northwind Labs/);
});

test('parseOutput takes the array out of whatever surrounds it, keeps the time, and drops entries without one', () => {
  const text = `Here is what I found:\n[{"company":"Northwind Labs","role":"Staff Design Engineer","kind":"interview","start":"${plus(2)} 14:30","end":"${plus(2)} 15:15","summary":"Northwind Labs: Design Systems loop (2/4)","gist":"A panel interview.","with":"Sam Example, Priya Example","location":"https://meet.google.com/abc-defg-hij","eventId":"evt1","calendar":"Primary"},{"company":"Nowhere Inc","kind":"interview","start":"next week","eventId":"evt2"},{"company":"Fjord Analytics","kind":"nonsense","start":"${plus(5)}","eventId":"evt3"}]\nDone.`;
  const out = cc.parseOutput(text);
  assert.equal(out.length, 2, 'the one with no readable time is dropped');
  assert.equal(out[0].start, `${plus(2)} 14:30`);
  assert.equal(out[0].end, `${plus(2)} 15:15`);
  assert.equal(out[1].kind, 'other', 'an unknown kind is other');
  assert.equal(out[1].start, plus(5), 'a date without a time stays a date');
  assert.throws(() => cc.parseOutput('I could not read the calendar.'), /no JSON array/);
});

test('every item has a place to open in Google Calendar: its own link, else the edit address from the ids, else its day', () => {
  assert.equal(cc.eventLink({ link: 'https://calendar.google.com/calendar/event?eid=abc' }), 'https://calendar.google.com/calendar/event?eid=abc');
  const built = cc.eventLink({ id: 'evt123', calendarId: 'someone@example.test', start: '2026-10-09 09:00' });
  assert.match(built, /^https:\/\/calendar\.google\.com\/calendar\/u\/0\/r\/eventedit\/[A-Za-z0-9+/]+$/);
  assert.equal(Buffer.from(built.split('/').pop(), 'base64').toString(), 'evt123 someone@example.test');
  assert.equal(cc.eventLink({ id: 'Acme|2026-10-09', start: '2026-10-09 09:00' }), 'https://calendar.google.com/calendar/u/0/r/day/2026/10/9');
  const parsed = cc.parseOutput(JSON.stringify([{ company: 'Acme', kind: 'interview', start: '2026-10-09 09:00', eventId: 'e9', calendarId: 'me@example.test', link: 'https://calendar.google.com/calendar/event?eid=xyz' }, { company: 'Acme', kind: 'interview', start: '2026-10-10 09:00', eventId: 'e10', link: 'https://evil.example/phish' }]));
  assert.equal(parsed[0].link, 'https://calendar.google.com/calendar/event?eid=xyz');
  assert.equal(parsed[1].link, '', 'only a Google Calendar address is kept as the link');
});

test('reconcile matches by role, then by the one note in flight at the company, and offers the rest as a pick', () => {
  const notes = store.listJobs();
  const northwind = notes.find((n) => n.company === 'Northwind Labs');
  const events = cc.parseOutput(JSON.stringify([
    { company: 'Northwind Labs', role: 'Staff Design Engineer', kind: 'interview', start: `${plus(2)} 14:30`, eventId: 'e1' },
    { company: 'Nobody Co', kind: 'recruiter-call', start: `${plus(1)} 09:00`, eventId: 'e2' },
  ]));
  const r = cc.reconcile(events, notes);
  assert.equal(r[0].company, 'Nobody Co', 'sorted by start');
  assert.equal(r[0].match, 'none');
  assert.equal(r[0].suggestion.action, 'none');
  assert.equal(r[1].match, 'role');
  assert.equal(r[1].noteId, northwind.id);
  assert.equal(r[1].suggestion.action, ['interviewing', 'offer'].includes(northwind.status) ? 'record' : 'status');
  assert.equal(cc.suggestionFor('deadline', 'applied').action, 'deadline');
  assert.equal(cc.suggestionFor('recruiter-call', 'reviewing').action, 'record');
  assert.equal(cc.suggestionFor('screen', 'applied').status, 'interviewing');
});

test('confirming writes the time into Interview on, moves the note, and records the event; dismissing writes nothing', () => {
  const notes = store.listJobs();
  const applied = notes.find((n) => n.status === 'applied') || notes.find((n) => n.status === 'applying');
  const items = cc.reconcile(cc.parseOutput(JSON.stringify([
    { company: applied.company, role: applied.title, kind: 'screen', start: `${plus(3)} 10:00`, end: `${plus(3)} 10:30`, summary: `${applied.company} phone screen`, with: 'A Recruiter', eventId: 'e-screen' },
    { company: applied.company, kind: 'deadline', start: plus(9), summary: 'Take-home due', eventId: 'e-deadline' },
    { company: 'Nobody Co', kind: 'interview', start: `${plus(4)} 11:00`, eventId: 'e-nobody' },
  ])), notes);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, 'calendar-check.json'), JSON.stringify({ lastRun: new Date().toISOString(), days: 21, items }));
  assert.equal(cc.items().pending.length, 3);

  cc.confirm('e-screen');
  const after = store.getJob(applied.id);
  assert.equal(after.status, 'interviewing', 'a screen on an applied note moves it to interviewing');
  const text = fs.readFileSync(after.path, 'utf8');
  assert.match(text, new RegExp(`^- \\*\\*Interview on:\\*\\*\\s*${plus(3)} 10:00`, 'm'));
  assert.match(text, /Calendar, .* \(screen\): .*phone screen, with A Recruiter/);
  assert.ok(store.calendar().upcoming.some((e) => e.id === applied.id && e.kind === 'interview'), 'the Calendar page shows it');

  cc.confirm('e-deadline');
  assert.match(fs.readFileSync(after.path, 'utf8'), new RegExp(`^- \\*\\*Deadline:\\*\\*\\s*${plus(9)}`, 'm'));

  const before = store.listJobs().length;
  cc.dismiss('e-nobody');
  assert.equal(store.listJobs().length, before, 'dismissing creates nothing');
  const state = cc.items();
  assert.equal(state.pending.length, 0);
  assert.deepEqual(state.items.map((i) => i.state).sort(), ['confirmed', 'confirmed', 'dismissed']);
  assert.throws(() => cc.confirm('nope'), /No calendar item/);
});
