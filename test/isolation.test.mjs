// Two profiles on one machine must not see each other. A QA run on 2026-10-07 created a second profile through
// TEKJOBS_PROFILE and found the first person's resume files offered as its resume variants, because the resume of
// record and the variants folder lived in ~/.tekjobs/config.json; creating the profile also moved the machine's
// profile pointer. This starts the real server twice against one temp home: once as the other profile (nothing of
// the first person's may show, and nothing it does may move the pointer), once as the profile the old settings
// were saved for (they are adopted into that profile and leave the machine file).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tekjobs-isolation-'));
const first = path.join(home, 'First');   // the person already using the machine
const second = path.join(home, 'Second'); // the sample, a test persona, anyone else
let child = null;
let base = '';

const get = async (p) => { const r = await fetch(base + p); return { status: r.status, body: await r.json() }; };
const send = async (method, p, body) => { const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) }); return { status: r.status, body: await r.json() }; };
const config = () => JSON.parse(fs.readFileSync(path.join(home, '.tekjobs', 'config.json'), 'utf8'));
const own = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dir, '.tekjobs', 'settings.json'), 'utf8')); } catch { return null; } };

async function start(profile) {
  await stop();
  const PORT = 18900 + Math.floor(Math.random() * 200);
  base = `http://127.0.0.1:${PORT}`;
  child = spawn(process.execPath, [path.join(ROOT, 'app', 'server', 'index.mjs')], {
    env: { ...process.env, HOME: home, USERPROFILE: home, TEKJOBS_PROFILE: profile, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`server did not start: ${out}`)), 15000);
    child.stdout.on('data', (d) => { out += d; if (out.includes('TekJobs server')) { clearTimeout(t); resolve(); } });
    child.stderr.on('data', (d) => { out += d; });
    child.on('exit', (code) => reject(new Error(`server exited ${code}: ${out}`)));
  });
}
async function stop() {
  if (!child) return;
  const c = child; child = null;
  await new Promise((resolve) => { c.on('exit', resolve); c.kill(); setTimeout(resolve, 3000); });
}

before(() => {
  for (const dir of [first, second]) fs.cpSync(path.join(ROOT, 'samples', 'vault'), dir, { recursive: true });
  fs.mkdirSync(path.join(first, 'Templates', 'Resume'), { recursive: true });
  fs.writeFileSync(path.join(first, 'Templates', 'Resume', 'First Person - Resume.md'), '# First Person\n\nA resume that belongs to the first person only.\n');
  fs.mkdirSync(path.join(home, '.tekjobs'), { recursive: true });
  // The machine config as an install before 0.38 left it: the pointer plus the first person's resume settings.
  fs.writeFileSync(path.join(home, '.tekjobs', 'config.json'), JSON.stringify({
    profile: first,
    resumeSource: path.join(first, 'Templates', 'Resume', 'First Person - Resume.md'),
    resumeDir: path.join(first, 'Templates', 'Resume'),
    contact: 'first@example.test',
  }, null, 2));
});
after(async () => { await stop(); });

test('a second profile sees none of the first person\'s resume settings or files', async () => {
  await start(second);
  const s = (await get('/api/settings')).body;
  assert.equal(s.profile.active, second);
  assert.equal(s.profile.fromEnv, true);
  assert.equal(s.resumeSource, '', 'no resume of record is inherited');
  assert.equal(s.resumeDir.configured, '', 'no variants folder is inherited');
  assert.equal(path.resolve(s.resumeDir.path), path.join(second, 'Templates', 'Resume'), 'the default is inside this profile');
  assert.equal(s.profileSettingsFile, path.join(second, '.tekjobs', 'settings.json'));
  const r = (await get('/api/resumes')).body;
  assert.deepEqual(r.files, [], 'the first person\'s resume file is not offered as a variant');
  assert.equal(own(second), null, 'nothing was written into the second profile just by reading');
  assert.ok(config().resumeSource, 'the first person\'s settings are still in the machine file, untouched');
});

test('creating or importing into a profile from the app never moves the machine pointer', async () => {
  const before = config().profile;
  assert.equal((await send('POST', '/api/onboarding/init')).status, 200);
  assert.equal(config().profile, before, 'onboarding init left the pointer alone');
  const imp = await send('POST', '/api/onboarding/resume', { path: path.join(ROOT, 'samples', 'vault', 'Profile', 'Resume.md') });
  assert.equal(imp.status, 200, JSON.stringify(imp.body));
  assert.equal(config().profile, before, 'a resume import left the pointer alone');
});

test('the variants folder saved from Settings lands in the profile, not the machine file', async () => {
  fs.mkdirSync(path.join(second, 'Templates', 'Resume'), { recursive: true });
  const r = await send('PUT', '/api/settings', { resumeDir: path.join(second, 'Templates', 'Resume') });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(path.resolve(own(second).resumeDir), path.join(second, 'Templates', 'Resume'));
  assert.equal(config().resumeDir, path.join(first, 'Templates', 'Resume'), 'the machine file still holds only what it held');
});

test('the profile the old settings were saved for adopts them, and they leave the machine file', async () => {
  await start(first);
  const s = (await get('/api/settings')).body;
  assert.equal(s.resumeSource, path.join(first, 'Templates', 'Resume', 'First Person - Resume.md'));
  assert.equal(path.resolve(s.resumeDir.path), path.join(first, 'Templates', 'Resume'));
  const files = (await get('/api/resumes')).body.files.map((f) => f.name);
  assert.deepEqual(files, ['First Person - Resume.md']);
  const adopted = own(first);
  assert.equal(adopted.resumeSource, s.resumeSource);
  assert.ok(adopted.adopted, 'the adoption is dated');
  const cfg = config();
  assert.equal(cfg.resumeSource, undefined);
  assert.equal(cfg.resumeDir, undefined);
  assert.equal(cfg.profile, first, 'the pointer and the contact stay');
  assert.equal(cfg.contact, 'first@example.test');
  await stop();
});
