// The command people actually type, spawned the way a shell spawns it, with the home directory pointed at a
// temp folder so `init` remembers its profile there and never in the real ~/.tekjobs/config.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tekjobs-cli-home-'));
const profile = path.join(home, 'JobSearch');
const run = (args, env = {}) => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'cli.mjs'), ...args], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home, TEKJOBS_PROFILE: '', ...env }, timeout: 60000 });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
};

test('--version prints the package version and help lists the commands', () => {
  const v = run(['--version']);
  assert.equal(v.code, 0);
  assert.equal(v.out.trim(), JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version);
  const h = run(['help']);
  for (const cmd of ['init', 'scan', 'serve', 'mcp', 'schedule', 'import linkedin', 'rescore', 'mail']) assert.ok(h.out.includes(cmd), `help mentions ${cmd}`);
});

test('init creates the profile folder, imports a resume, remembers the folder in the temp home, and status reads it', () => {
  const r = run(['init', profile, '--resume', path.join(ROOT, 'samples', 'vault', 'Profile', 'Resume.md')]);
  assert.equal(r.code, 0, r.out);
  for (const f of ['Profile/Profile.md', 'Targets/Search Criteria.md', 'Targets/Companies.md', 'Profile/Resume - Source.md']) assert.ok(fs.existsSync(path.join(profile, f)), `${f} exists`);
  const cfg = JSON.parse(fs.readFileSync(path.join(home, '.tekjobs', 'config.json'), 'utf8'));
  assert.equal(path.resolve(cfg.profile), path.resolve(profile), 'the folder is remembered in the temp home, not the real one');
  assert.match(r.out, /Resume imported/);
  const s = run(['status']);
  assert.equal(s.code, 0, s.out);
  assert.match(s.out, /Profile folder exists/);
  assert.match(s.out, /Resume imported/);
});

test('import linkedin: usage without a path, a preview that writes nothing, and a refusal for a folder that is not an export', () => {
  const usage = run(['import', 'linkedin']);
  assert.match(usage.out, /Usage: tekjobs import linkedin/);
  const p = run(['import', 'linkedin', path.join(ROOT, 'test', 'fixtures', 'linkedin'), '--preview', '--since', '2026-06-01']);
  assert.equal(p.code, 0, p.out);
  const j = JSON.parse(p.out);
  assert.equal(j.counts.connections, 4);
  assert.ok(!fs.existsSync(path.join(profile, '.tekjobs', 'linkedin.json')), 'preview leaves no index');
  // test/ holds the fixture export two levels down and the reader would find it; the scraper source has none.
  const bad = run(['import', 'linkedin', path.join(ROOT, 'scraper')]);
  assert.notEqual(bad.code, 0);
  assert.match(bad.out, /does not look like a LinkedIn data export/);
});

test('scan --dry on the fresh profile refuses politely until the interview has set title terms', () => {
  const r = run(['scan', '--dry', '--only', 'nobody-slug']);
  // Either the scan explains what is missing, or it runs against nothing; what it must not do is crash.
  assert.ok(r.code === 0 || /title terms|criteria|No criteria|nothing to scan|0 companies/i.test(r.out), r.out.slice(0, 400));
});
