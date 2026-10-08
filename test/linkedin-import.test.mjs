import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// A throwaway profile folder: config.mjs reads the environment when it loads, so it is set before the import.
const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'tekjobs-linkedin-'));
process.env.TEKJOBS_PROFILE = vault;
const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, 'fixtures', 'linkedin');
const { ensureDirs, P } = await import('../scraper/config.mjs');
const { runImport, preview, connectionsAt, status, loadIndex, importJobs } = await import('../app/server/linkedin-import.mjs');
const people = await import('../app/server/people.mjs');
const store = await import('../app/server/store.mjs');
ensureDirs();
// One open job note at Northwind, so the recruiter who wrote lands on its People section.
fs.writeFileSync(path.join(P.jobs, 'Northwind Traders - Staff Design Engineer (1).md'), `---\ncompany: "Northwind Traders"\ntitle: "Staff Design Engineer"\nstatus: new\nscore: 90\nfound: 2026-09-20\nsource: greenhouse\nurl: https://example.com/1\n---\n# Staff Design Engineer\n\n## Why it matched\n- title\n\n## People\n\n## Status log\n`);

test('preview reads without writing', () => {
  const p = preview(fixture, { since: '2026-06-01' });
  assert.equal(p.self, 'Avery Sample');
  assert.equal(p.people.candidates, 2);
  assert.equal(p.people.chosen, 1, 'Jane the recruiter; Mina the design engineer is not a search contact by default');
  assert.equal(p.warmPaths.jobsWithConnections, 1);
  assert.equal(p.warmPaths.top[0].count, 2);
  assert.ok(!fs.existsSync(P.linkedin), 'preview leaves no index behind');
  assert.equal(status().imported, null);
});

test('the import writes the index, a People note with its log, and a link on the job note', () => {
  const s = runImport(fixture, { since: '2026-06-01' });
  assert.ok(fs.existsSync(P.linkedin));
  assert.equal(s.people.created, 1);
  assert.equal(s.people.attached, 1);
  assert.equal(s.people.logged, 1);
  const jane = people.listPeople().find((p) => p.name === 'Jane Doe');
  assert.ok(jane, 'Jane Doe exists');
  assert.equal(jane.role, 'recruiter');
  assert.equal(jane.company, 'Northwind Traders, Inc.');
  const note = fs.readFileSync(jane.path, 'utf8');
  assert.match(note, /## Log\n- 2026-09-18 \(linkedin message\): Staff Design Engineer at Northwind/);
  assert.match(note, /## Threads\n- \[\[Jobs\/Northwind Traders - Staff Design Engineer \(1\)/);
  const job = fs.readFileSync(path.join(P.jobs, 'Northwind Traders - Staff Design Engineer (1).md'), 'utf8');
  assert.match(job, /## People\n- \[\[People\/Jane Doe \(Northwind Traders, Inc.\)\|Jane Doe\]\] · recruiter · LinkedIn, 2026-09-18/);
  assert.equal(connectionsAt('Northwind Traders').count, 2);
  assert.equal(status().counts.connections, 4);
  assert.ok(loadIndex().threads.length >= 1);
});

test('running it again recognises everyone and appends nothing twice', () => {
  const before = fs.readFileSync(people.listPeople().find((p) => p.name === 'Jane Doe').path, 'utf8');
  const s = runImport(fixture, { since: '2026-06-01' });
  assert.equal(s.people.created, 0);
  assert.equal(s.people.recognised, 1);
  assert.equal(s.people.logged, 0);
  assert.equal(s.people.attached, 0);
  assert.equal(fs.readFileSync(people.listPeople().find((p) => p.name === 'Jane Doe').path, 'utf8'), before);
});

test('everyone=true also writes the people whose title is not a search role, and dry writes nothing', () => {
  const dry = runImport(fixture, { since: '2026-06-01', everyone: true, dry: true });
  assert.equal(dry.people.created, 2, 'dry counts what it would create');
  assert.ok(!people.listPeople().some((p) => p.name === 'Mina Park'));
  runImport(fixture, { since: '2026-06-01', everyone: true });
  assert.ok(people.listPeople().some((p) => p.name === 'Mina Park'));
});

test('applications become notes at applied with the date, saved jobs at reviewing, and a second run changes nothing', () => {
  const before = store.listJobs().length;
  const dry = importJobs(fixture, { since: '2026-01-01', applications: true, saved: true, dry: true });
  assert.equal(dry.dry, true);
  assert.equal(dry.applications.matched + dry.applications.created, 1, 'one of the two fixture applications is since the date');
  assert.equal(dry.applications.skipped, 1, 'the 2018 one is before it');
  assert.equal(dry.applications.matched, 1, 'the Northwind application matches the Northwind note that exists');
  assert.equal(dry.saved.matched + dry.saved.created, 1, 'and one saved job');
  assert.equal(store.listJobs().length, before, 'a dry run writes nothing');

  const r = importJobs(fixture, { since: '2026-01-01', applications: true, saved: true });
  const after = store.listJobs();
  assert.equal(after.length, before + r.applications.created + r.saved.created);
  const applied = after.filter((j) => j.status === 'applied');
  assert.ok(applied.length >= r.applications.created + r.applications.marked, 'applications are at applied');
  for (const j of applied) {
    const text = fs.readFileSync(store.getJob(j.id).path, 'utf8');
    assert.match(text, /^- \*\*Applied on:\*\*\s*\d{4}-\d{2}-\d{2}/m, 'the date is filled in');
    assert.match(text, /linkedin-export/, 'the status log says where it came from');
  }
  assert.equal(after.filter((j) => j.status === 'reviewing').length >= r.saved.created, true, 'saved jobs are shortlisted');

  const again = importJobs(fixture, { since: '2026-01-01', applications: true, saved: true });
  assert.equal(store.listJobs().length, after.length, 'no duplicates on a second run');
  assert.equal(again.applications.created, 0);
  assert.equal(again.saved.created, 0);
});
