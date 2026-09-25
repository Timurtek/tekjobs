// The MCP server's tool table and dispatcher, in-process, against a copy of the fictional sample vault: every
// advertised tool has a handler, the read-only tools answer, an unknown tool is refused the JSON-RPC way, and
// the count the docs print is the count the server advertises.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'tekjobs-mcp-'));
fs.cpSync(path.join(ROOT, 'samples', 'vault'), vault, { recursive: true });
process.env.TEKJOBS_PROFILE = vault;
const { TOOLS, call } = await import('../app/server/mcp.mjs');
const source = fs.readFileSync(path.join(ROOT, 'app', 'server', 'mcp.mjs'), 'utf8');

test('every advertised tool has a handler, names are unique, and the docs count matches', () => {
  const names = TOOLS.map((t) => t.name);
  assert.equal(new Set(names).size, names.length, 'no duplicate tool names');
  for (const n of names) assert.ok(source.includes(`case '${n}':`), `no handler for ${n}`);
  const handled = [...source.matchAll(/case '([a-z_]+)':/g)].map((m) => m[1]);
  for (const h of handled) assert.ok(names.includes(h), `handler ${h} is not advertised`);
  for (const t of TOOLS) { assert.ok(t.description.length > 40, `${t.name} has a description`); assert.equal(t.inputSchema.type, 'object', `${t.name} has an object schema`); }
  const counts = JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'src', 'counts.json'), 'utf8'));
  assert.equal(counts.tools, names.length, 'site/src/counts.json is stale: run npm run counts');
});

test('the read-only tools answer on the sample vault', async () => {
  const readOnly = {
    onboarding_status: {}, onboarding_materials: {}, summary: {}, today: {}, search_jobs: {}, outcomes: {}, get_criteria: {}, list_criteria_presets: {},
    list_companies: {}, list_feeds: {}, scan_status: {}, scan_preview: {}, list_people: {}, list_snippets: {}, mail_items: {}, connections_at: { company: 'Northwind' },
  };
  for (const [name, args] of Object.entries(readOnly)) {
    assert.ok(TOOLS.some((t) => t.name === name), `${name} is a tool`);
    const r = await call(name, args);
    assert.ok(r !== undefined && r !== null, `${name} returned something`);
  }
  const jobs = await call('search_jobs', {});
  const rows = jobs.rows || jobs;
  assert.ok(rows.length >= 10, `search_jobs found ${rows.length}`);
  const job = await call('get_job', { id: rows[0].id });
  assert.equal(job.id, rows[0].id);
  const packet = await call('application_packet', { id: rows[0].id });
  assert.ok(packet && typeof packet === 'object');
  const st = await call('scan_status', {});
  assert.equal(typeof st.running, 'boolean');
});

test('an unknown tool is refused with the JSON-RPC method-not-found code', async () => {
  await assert.rejects(() => call('no_such_tool', {}), (e) => e.code === -32601 && /unknown tool/.test(e.message));
});

test('a write tool writes into the copy of the vault, not the repository', async () => {
  const p = await call('add_person', { name: 'Mcp Tester', role: 'interviewer', company: 'Contoso' });
  assert.equal(p.name, 'Mcp Tester');
  assert.ok(fs.existsSync(path.join(vault, 'People', `${p.id}.md`)));
  assert.ok(!fs.existsSync(path.join(ROOT, 'samples', 'vault', 'People', `${p.id}.md`)), 'the sample vault in the repo is untouched');
});
