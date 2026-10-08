// The daily journal: the day read back from the record. A temp profile with a run in the log, two notes found
// today, three decisions made today by three different hands, a mail item confirmed today, and a note line; the
// journal names all of them, and writing it twice leaves one section.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'tekjobs-journal-'));
process.env.TEKJOBS_PROFILE = vault;
const { P, DATA_DIR, ensureDirs } = await import('../scraper/config.mjs');
const { buildJournal, renderJournal, writeJournal, JOURNAL_HEADING } = await import('../scraper/journal.mjs');
const { signalsOf } = await import('../app/server/store.mjs');
ensureDirs();
fs.mkdirSync(P.logs, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const note = (name, fm, body) => fs.writeFileSync(path.join(P.jobs, `${name}.md`), `---\n${Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n# ${name}\n\n## Status log\n${body}\n`);
note('Northwind Labs - Staff Design Engineer (1)', { company: '"Northwind Labs"', title: '"Staff Design Engineer"', status: 'applied', score: 148, found: today },
  `- ${today} — new → **reviewing** (via app)\n- ${today} — reviewing → **applying** (via mcp)\n- ${today} — applying → **applied** (via linkedin-export)\n\n## Notes\n- ${today} (app): Applied through LinkedIn on ${today} (from the LinkedIn export).`);
note('Orbital Software - Senior Design Engineer (2)', { company: '"Orbital Software"', title: '"Senior Design Engineer"', status: 'passed', score: 129, found: today },
  `- ${today} — new → **passed** (too visual) (via app)`);
note('Old Co - Design Engineer (3)', { company: '"Old Co"', title: '"Design Engineer"', status: 'new', score: 70, found: '2026-09-01' }, `- 2026-09-02 — new → **reviewing** (via app)`);
fs.writeFileSync(path.join(DATA_DIR, 'mail-check.json'), JSON.stringify({ items: [
  { id: 'm1', company: 'Northwind Labs', role: 'Staff Design Engineer', kind: 'confirmation', state: 'confirmed', resolved: { at: `${today}T10:00:00.000Z`, action: 'status', status: 'applied' } },
  { id: 'm2', company: 'Spam Co', role: '', kind: 'other', state: 'dismissed', resolved: { at: `${today}T10:01:00.000Z`, action: 'dismissed' } },
  { id: 'm3', company: 'Yesterday Inc', role: '', kind: 'rejection', state: 'confirmed', resolved: { at: '2026-01-01T10:00:00.000Z', action: 'status', status: 'rejected' } },
] }));
fs.writeFileSync(path.join(P.logs, `${today}.md`), `---\ntype: log\ndate: ${today}\n---\n# ${today} — scraper log\n\n## Run ${today} 07:30 UTC\n- Boards: 304/304 ok · postings scanned: 22,634 · dropped by exclusions: 2576 · scored ≥ 45: 89 · **new: 2** · closed: 1 · 142.9s\n- Via: schedule\n\n## Run ${today} 09:00 UTC (dry)\n- Boards: 304/304 ok · postings scanned: 22,000 · scored ≥ 45: 80 · **new: 0** · closed: 0 · 100s\n\n`);

test('the journal reads the day back from the record', () => {
  const j = buildJournal(today);
  assert.equal(j.empty, false);
  assert.equal(j.runs.length, 2);
  assert.equal(j.runs[0].newNotes, 2);
  assert.equal(j.runs[1].dry, true);
  assert.deepEqual(j.found.map((f) => f.company).sort(), ['Northwind Labs', 'Orbital Software']);
  assert.equal(j.moves.length, 4, 'three moves on one note, one on another; yesterday\'s move is not today\'s');
  assert.deepEqual([...new Set(j.moves.map((m) => m.via))].sort(), ['app', 'linkedin-export', 'mcp']);
  assert.equal(j.byTo.passed[0].reason, 'too visual');
  assert.equal(j.mail.confirmed, 1);
  assert.equal(j.mail.dismissed, 1);
  assert.equal(j.notes.length, 1);
  const md = renderJournal(j);
  assert.match(md, /^## Journal/);
  assert.match(md, /\*\*Scan\*\*: 1 run; the last read 304\/304 boards and 22,634 postings, wrote 2 new notes, closed 1/);
  assert.match(md, /\*\*Found\*\*: 2 new matches\. Best: Northwind Labs — Staff Design Engineer \(148\)/);
  assert.match(md, /\*\*Applied to\*\*: 1 Northwind Labs — Staff Design Engineer \(via linkedin-export\)/);
  assert.match(md, /\*\*Passed on\*\*: 1 Orbital Software — Senior Design Engineer \(too visual\) \(via app\)/);
  assert.match(md, /\*\*Mail\*\*: 1 item confirmed \(1 confirmation\), 1 dismissed/);
  assert.match(md, /\*\*Notes\*\*: 1 line added across 1 job notes/);
});

test('writing the journal puts one section at the end of the log, and writing again replaces it', () => {
  const first = writeJournal(today);
  const text1 = fs.readFileSync(first.file, 'utf8');
  assert.equal(text1.split(JOURNAL_HEADING).length - 1, 1);
  assert.ok(text1.includes('## Run'), 'the run sections stay');
  assert.ok(text1.trimEnd().endsWith(first.markdown.trimEnd()), 'the journal is the last section');
  // Another decision lands; the rewrite reflects it and does not duplicate the section.
  fs.appendFileSync(path.join(P.jobs, 'Old Co - Design Engineer (3).md'), `- ${today} — reviewing → **applying** (via app)\n`);
  const second = writeJournal(today);
  const text2 = fs.readFileSync(second.file, 'utf8');
  assert.equal(text2.split(JOURNAL_HEADING).length - 1, 1, 'still one journal');
  // Northwind moved to applying today too, so the line counts two and names both, with both hands.
  assert.match(text2, /\*\*Started applying to\*\*: 2 Northwind Labs — Staff Design Engineer; Old Co — Design Engineer \(via mcp, app\)/);
});

test('a day with nothing in it says so, and a day with no log note gets one', () => {
  const quiet = '2020-02-02';
  const j = buildJournal(quiet);
  assert.equal(j.empty, true);
  assert.match(renderJournal(j), /Nothing happened in the search today/);
  const w = writeJournal(quiet);
  const text = fs.readFileSync(w.file, 'utf8');
  assert.match(text, /^---\ntype: log\ndate: 2020-02-02\n---/);
  assert.match(text, /## Journal/);
});

test('the markers read the lines the mail and calendar checks write under Notes, counted, with the latest', () => {
  const text = [
    '## Notes',
    '- 2026-10-01 (app): Mail, 2026-09-30 (confirmation): Thanks for applying. [message](https://mail.google.com/mail/u/0/#all/abc)',
    '- 2026-10-05 (app): Mail, 2026-10-05 (scheduling): Please pick a slot. [message](https://mail.google.com/mail/u/0/#all/def)',
    '- 2026-10-07 (app): Calendar, 2026-10-09 09:00 to 09:45 (interview): Interview with Northwind, with Sam Example [https://meet.example]',
    '- 2026-10-07 (app): a line the person wrote, which is not a signal',
  ].join('\n');
  const s = signalsOf(text);
  assert.equal(s.mail, 2);
  assert.equal(s.mailLast, '2026-10-05');
  assert.equal(s.mailKind, 'scheduling');
  assert.equal(s.calendar, 1);
  assert.equal(s.calendarLast, '2026-10-09');
  assert.equal(s.calendarKind, 'interview');
  assert.deepEqual(signalsOf('nothing here'), { mail: 0, mailLast: '', mailKind: '', calendar: 0, calendarLast: '', calendarKind: '' });
});
