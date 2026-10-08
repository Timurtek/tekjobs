// The readiness contract. A QA run on 2026-10-07 saw onboarding report 5 of 5 and the Profile page then warn that
// the resume of record, Positioning and Voice were missing. Now the import creates the resume of record, the
// interview can save Positioning and Voice through save_profile, and onboarding reports two things: search ready
// and writing ready.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tekjobs-readiness-'));
const profile = path.join(home, 'JobSearch');
process.env.HOME = home; process.env.USERPROFILE = home;
process.env.TEKJOBS_PROFILE = profile;
const { initProfile, importResume, onboardingStatus, saveProfile, onboardingMaterials } = await import('../scraper/profile.mjs');
const { readProfileSettings } = await import('../scraper/config.mjs');
const store = await import('../app/server/store.mjs');

const read = (rel) => fs.readFileSync(path.join(profile, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(profile, rel));

test('a fresh profile is neither search ready nor writing ready, and says what each needs', () => {
  initProfile(profile);
  const s = onboardingStatus(profile);
  assert.equal(s.complete, false);
  assert.equal(s.writingReady, false);
  assert.deepEqual(s.writing.map((w) => w.id), ['record', 'positioning', 'voice']);
  assert.ok(s.writing.every((w) => !w.done && w.how.length > 20));
});

test('importing a resume creates the resume of record in the sync shape and remembers the file as the source', async () => {
  const r = await importResume(path.join(ROOT, 'samples', 'vault', 'Profile', 'Resume.md'), profile);
  assert.equal(r.recordCreated, true);
  assert.equal(path.resolve(r.record), path.join(profile, 'Profile', 'Resume.md'));
  const note = read('Profile/Resume.md');
  assert.match(note, /^---\ntype: resume\nstatus: current\nsource: /);
  assert.match(note, /source_kind: file/);
  assert.match(note, /Jordan Example/, 'the body is the resume text');
  assert.ok(exists('Profile/Resume - Source.md'), 'the import text is still written beside it');
  assert.equal(path.resolve(readProfileSettings().resumeSource), path.join(profile, 'Profile', 'Resume - Original.md'), 'the source is the imported copy, in the profile, not the machine config');
  assert.equal(onboardingStatus(profile).writing.find((w) => w.id === 'record').done, true);
});

test('a second import leaves an existing resume of record alone and says so', async () => {
  fs.writeFileSync(path.join(profile, 'Profile', 'Resume.md'), '---\ntype: resume\nstatus: current\n---\nedited by hand\n');
  const r = await importResume(path.join(ROOT, 'samples', 'vault', 'Profile', 'Resume.md'), profile);
  assert.equal(r.recordCreated, false);
  assert.match(read('Profile/Resume.md'), /edited by hand/);
});

test('save_profile writes Positioning and Voice with their own frontmatter, keeps the previous version, and the interview script asks for them', () => {
  const pos = saveProfile('# Positioning\n\n## Which story leads\nDesign engineer first.\n\n## The evidence rule\nEvery claim traces to a line of the resume.\n\n## What must never be claimed\n- Managing a team.\n', profile, { note: 'positioning' });
  assert.equal(pos.note, 'positioning');
  assert.match(read('Profile/Positioning.md'), /^---\ntype: positioning\nupdated: \d{4}-\d{2}-\d{2}\n---\n# Positioning/);
  saveProfile('# Voice\n\n## Rules\n- Short sentences.\n\n## A letter I would send\nHello. One proof point, with its number. Jordan.\n', profile, { note: 'voice' });
  assert.match(read('Profile/Voice.md'), /^---\ntype: voice\n/);
  saveProfile('# Voice\n\n## Rules\n- Plain words, second version.\n\n## A letter I would send\nHello again. Jordan.\n', profile, { note: 'voice' });
  assert.ok(fs.readdirSync(path.join(profile, 'Profile')).some((f) => /^Voice\.before-\d{4}-\d{2}-\d{2}\.md$/.test(f)), 'the first version is kept beside it');
  assert.throws(() => saveProfile('too short', profile, { note: 'positioning' }), /too short/);
  assert.throws(() => saveProfile('x'.repeat(200), profile, { note: 'snippets' }), /note must be one of/);
  const script = onboardingMaterials(profile).script;
  assert.match(script, /note=positioning/);
  assert.match(script, /note=voice/);
  assert.match(script, /How they write/);
});

test('with the three notes present, writing is ready while search still waits on the interview and the scan', () => {
  const s = onboardingStatus(profile);
  assert.equal(s.writingReady, true);
  assert.equal(s.complete, false, 'search readiness is a separate contract');
  assert.equal(s.steps.find((x) => x.id === 'profile').done, false);
});

test('a starter profile names nobody: the empty Name line does not borrow the next line as a name', () => {
  const who = store.who();
  assert.equal(who.name, '', 'not "- Location / time zone:"');
  const s = store.profileSummary();
  assert.equal(s.basics.name, '');
  assert.equal(s.basics.location, '');
});
