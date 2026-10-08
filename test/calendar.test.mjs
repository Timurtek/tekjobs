// The calendar is the record read as dates: the packet's Interview on, Follow-up due, Deadline and Applied on
// lines, served as events and as an .ics feed. A copy of the sample vault with one note given all four.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'tekjobs-calendar-'));
fs.cpSync(path.join(ROOT, 'samples', 'vault'), vault, { recursive: true });
process.env.TEKJOBS_PROFILE = vault;
const store = await import('../app/server/store.mjs');
const { localDay } = await import('../scraper/config.mjs');

const today = localDay();
const plus = (n) => localDay(new Date(Date.now() + n * 864e5));

test('the packet has the Interview on field, and the dated fields become events in date order', () => {
  assert.ok(store.APPLICATION_FIELDS.some((f) => f.field === 'Interview on'));
  const job = store.listJobs().find((j) => j.status === 'applying' || j.status === 'reviewing') || store.listJobs()[0];
  store.saveApplicationDraft(job.id, { field: 'Interview on', value: `${plus(3)} 15:00` });
  store.saveApplicationDraft(job.id, { field: 'Follow-up due', value: plus(10) });
  store.saveApplicationDraft(job.id, { field: 'Deadline', value: plus(1) });
  store.saveApplicationDraft(job.id, { field: 'Applied on', value: plus(-2) });
  const cal = store.calendar();
  assert.equal(cal.today, today);
  const mine = cal.events.filter((e) => e.id === job.id);
  assert.deepEqual(mine.map((e) => e.kind), ['applied', 'deadline', 'interview', 'follow-up'], 'sorted by date');
  const interview = mine.find((e) => e.kind === 'interview');
  assert.equal(interview.date, plus(3));
  assert.equal(interview.time, '15:00');
  assert.equal(interview.company, job.company);
  assert.ok(cal.upcoming.some((e) => e.id === job.id && e.kind === 'deadline'));
  assert.ok(cal.past.some((e) => e.id === job.id && e.kind === 'applied'), 'the applied date is in the trail behind');
  assert.equal(cal.ics, '/api/calendar.ics');
});

test('the .ics feed carries interviews as timed local events and the rest as all-day, and leaves applied dates out', () => {
  const ics = store.calendarIcs();
  assert.match(ics, /^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\n/);
  assert.match(ics, /X-WR-CALNAME:TekJobs/);
  const events = ics.split('BEGIN:VEVENT').slice(1);
  assert.ok(events.length >= 3);
  const interview = events.find((e) => /SUMMARY:Interview: /.test(e));
  assert.ok(interview, 'an interview event');
  assert.match(interview, new RegExp(`DTSTART:${plus(3).replace(/-/g, '')}T150000\\r\\n`), 'timed, floating local time');
  assert.match(interview, /UID:interview-[A-Za-z0-9-]+@tekjobs\.local/);
  const deadline = events.find((e) => /SUMMARY:Deadline: /.test(e));
  assert.match(deadline, new RegExp(`DTSTART;VALUE=DATE:${plus(1).replace(/-/g, '')}\\r\\nDTEND;VALUE=DATE:${plus(2).replace(/-/g, '')}`), 'all-day with an exclusive end');
  assert.ok(!/SUMMARY:Applied/.test(ics), 'applied dates are the trail, not calendar entries');
  assert.match(ics, /END:VCALENDAR\r\n$/);
  assert.ok(!/[^\r]\n/.test(ics), 'CRLF line endings throughout');
});

test('a note whose date cannot be read is left out rather than guessed', () => {
  const job = store.listJobs().find((j) => !store.calendar().events.some((e) => e.id === j.id));
  store.saveApplicationDraft(job.id, { field: 'Interview on', value: 'next Tuesday, they said' });
  assert.ok(!store.calendar().events.some((e) => e.id === job.id && e.kind === 'interview'));
});
