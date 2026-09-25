// The API server, started the way `tekjobs serve` starts it, against a copy of the fictional sample vault: every
// read route answers 200 with JSON, the writes that are safe to exercise round-trip, and the fallbacks behave.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 18700 + Math.floor(Math.random() * 200);
const base = `http://127.0.0.1:${PORT}`;
let child, vault;

const get = async (p) => { const r = await fetch(base + p); return { status: r.status, body: r.headers.get('content-type')?.includes('json') ? await r.json() : await r.text() }; };
const send = async (method, p, body) => { const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) }); return { status: r.status, body: await r.json() }; };

before(async () => {
  vault = fs.mkdtempSync(path.join(os.tmpdir(), 'tekjobs-api-'));
  fs.cpSync(path.join(ROOT, 'samples', 'vault'), vault, { recursive: true });
  child = spawn(process.execPath, [path.join(ROOT, 'app', 'server', 'index.mjs')], { env: { ...process.env, TEKJOBS_PROFILE: vault, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`server did not start: ${out}`)), 15000);
    child.stdout.on('data', (d) => { out += d; if (out.includes('TekJobs server')) { clearTimeout(t); resolve(); } });
    child.stderr.on('data', (d) => { out += d; });
    child.on('exit', (code) => reject(new Error(`server exited ${code}: ${out}`)));
  });
});
after(() => { child?.kill(); });

test('every read route answers 200 with JSON on the sample vault', async () => {
  const reads = ['/api/summary', '/api/today', '/api/jobs', '/api/jobs/facets', '/api/people', '/api/runs', '/api/scan', '/api/outcomes', '/api/views', '/api/views/defaults', '/api/mail', '/api/criteria', '/api/criteria/presets', '/api/profile', '/api/profile/summary', '/api/companies', '/api/feeds', '/api/settings', '/api/resumes', '/api/snippets', '/api/onboarding', '/api/statuses', '/api/pass-reasons', '/api/application-fields', '/api/linkedin'];
  for (const p of reads) {
    const r = await get(p);
    assert.equal(r.status, 200, `${p} -> ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
    assert.equal(typeof r.body, 'object', `${p} is JSON`);
  }
});

test('the job routes work for a real note, and the sample vault has the shape the app expects', async () => {
  const jobs = (await get('/api/jobs')).body;
  const rows = jobs.rows || jobs;
  assert.ok(rows.length >= 10, `sample vault has ${rows.length} jobs`);
  const id = rows[0].id;
  for (const p of ['', '/packet', '/people', '/connections', '/cover-letter', '/resume']) {
    const r = await get(`/api/jobs/${encodeURIComponent(id)}${p}`);
    assert.equal(r.status, 200, `/api/jobs/:id${p} -> ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
  }
  const job = (await get(`/api/jobs/${encodeURIComponent(id)}`)).body;
  assert.equal(job.id, id);
  assert.ok(job.sections && typeof job.sections.why === 'string');
  const missing = await get('/api/jobs/no-such-note');
  assert.ok(missing.status >= 400, 'an unknown note is an error, not a 200');
  const summary = (await get('/api/summary')).body;
  assert.ok(summary.total >= rows.length || Object.keys(summary).length > 0);
});

test('people: create, attach to a job, log a contact, read back', async () => {
  const id = ((await get('/api/jobs')).body.rows || [])[0].id;
  const created = await send('POST', '/api/people', { name: 'Test Recruiter', role: 'recruiter', company: 'Northwind', email: 'test.recruiter@northwind.com' });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  assert.equal(created.body.name, 'Test Recruiter');
  const attached = await send('POST', `/api/people/${encodeURIComponent(created.body.id)}/attach`, { jobId: id, role: 'recruiter', context: 'api test' });
  assert.equal(attached.status, 200, JSON.stringify(attached.body));
  const logged = await send('POST', `/api/people/${encodeURIComponent(created.body.id)}/log`, { text: 'said hello' });
  assert.equal(logged.status, 200);
  assert.match(logged.body.log, /said hello/);
  const onJob = (await get(`/api/jobs/${encodeURIComponent(id)}/people`)).body;
  assert.ok(onJob.some((p) => p.name === 'Test Recruiter'), JSON.stringify(onJob));
  const again = await send('POST', '/api/people', { name: 'Test Recruiter', role: 'recruiter', company: 'Northwind' });
  assert.equal(again.body.id, created.body.id, 'the same person is recognised, not duplicated');
});

test('criteria: preview a change without applying it, presets list, snippets round-trip', async () => {
  const current = (await get('/api/criteria')).body;
  assert.ok(typeof current.raw === 'string' && current.parsed && current.fingerprint, 'criteria come back as raw JSON, a parsed object and a fingerprint');
  const raw = JSON.stringify({ ...current.parsed, minScore: 60 });
  const preview = await send('POST', '/api/criteria/preview', { raw });
  assert.equal(preview.status, 200, JSON.stringify(preview.body).slice(0, 200));
  assert.ok('fingerprintAfter' in preview.body || 'rows' in preview.body || 'byKind' in preview.body, Object.keys(preview.body).join(','));
  const after = (await get('/api/criteria')).body;
  assert.deepEqual(after, current, 'a preview changes nothing');
  const snippets = (await get('/api/snippets')).body;
  const saved = await send('PUT', '/api/snippets', { items: [...snippets.items, { group: 'Test', label: 'Zip', value: '97201' }] });
  assert.equal(saved.status, 200);
  assert.ok(saved.body.items.some((s) => s.label === 'Zip'));
  const back = await send('PUT', '/api/snippets', { items: snippets.items });
  assert.equal(back.body.items.length, snippets.items.length);
});

test('the LinkedIn preview reads the fixture export and writes nothing; a bad path is a 400', async () => {
  const ok = await send('POST', '/api/linkedin/preview', { source: path.join(ROOT, 'test', 'fixtures', 'linkedin'), since: '2026-06-01' });
  assert.equal(ok.status, 200, JSON.stringify(ok.body).slice(0, 200));
  assert.equal(ok.body.counts.connections, 4);
  assert.equal((await get('/api/linkedin')).body.imported, null);
  const bad = await send('POST', '/api/linkedin/preview', { source: path.join(ROOT, 'no-such-folder') });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /No such file/);
});

test('unknown API paths are 404 JSON; the static fallback answers with the build or a 503 without one', async () => {
  const nope = await get('/api/nothing-here');
  assert.equal(nope.status, 404);
  assert.match(nope.body.error, /no route/);
  const root = await fetch(base + '/');
  assert.ok([200, 503].includes(root.status), `static -> ${root.status}`);
});
