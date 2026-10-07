import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'tekjobs-find-board-'));
process.env.TEKJOBS_PROFILE = vault;
const { ensureDirs, P, loadCompanies } = await import('../scraper/config.mjs');
const { probeBoard, moveCompany, PROBE_ATS } = await import('../scraper/find-board.mjs');
ensureDirs();
fs.writeFileSync(P.companies, `# Companies

| Company | ATS | Slug | Tier | Status | Notes |
|---|---|---|---|---|---|
| Amplitude | greenhouse | amplitude | C | bad-slug (HTTP 404) |  |
| Northwind | lever | northwind | B | ok 12 jobs | watch the design team |
`);

// A fake fetcher that answers like the real boards did on 2026-10-07: Greenhouse gone, Ashby there.
const fake = async ({ ats, slug }) => {
  if (slug === 'amplitude' && ats === 'ashby') return { ok: true, jobs: new Array(34).fill({}) };
  if (slug === 'amplitude' && ats === 'greenhouse') return { ok: false, jobs: [], error: 'HTTP 404' };
  if (slug === 'amplitude' && ats === 'workable') return { ok: true, jobs: [] };   // answers, but with nothing: not a find
  if (ats === 'eightfold') throw new Error('network down');
  return { ok: false, jobs: [], error: 'HTTP 404' };
};

test('probeBoard asks every slug-addressable platform but the one that failed, and ranks the ones with jobs', async () => {
  const r = await probeBoard('amplitude', { except: 'greenhouse', fetch: fake });
  assert.deepEqual(r.tried, PROBE_ATS.filter((p) => p !== 'greenhouse'));
  assert.deepEqual(r.found.map((f) => [f.ats, f.jobs]), [['ashby', 34]]);
  assert.match(r.note, /Answers on ashby \(34 jobs\)/);
  const none = await probeBoard('nobody', { fetch: fake });
  assert.equal(none.found.length, 0);
  assert.match(none.note, /No platform answers/);
});

test('moveCompany rewrites the platform in place, clears the scan status and notes the move; other rows untouched', () => {
  const r = moveCompany({ slug: 'amplitude', from: 'greenhouse', to: 'ashby' }, { today: '2026-10-07' });
  assert.equal(r.moved, true);
  const rows = loadCompanies();
  const amp = rows.find((c) => c.slug === 'amplitude');
  assert.equal(amp.ats, 'ashby');
  assert.equal(amp.status, '');
  assert.equal(amp.notes, 'moved from greenhouse 2026-10-07');
  assert.deepEqual(rows.find((c) => c.slug === 'northwind'), { name: 'Northwind', ats: 'lever', slug: 'northwind', tier: 'B', status: 'ok 12 jobs', notes: 'watch the design team' });
  assert.match(fs.readFileSync(P.companies, 'utf8'), /^# Companies/, 'the heading survives');
  assert.equal(moveCompany({ slug: 'amplitude', to: 'ashby' }).moved, false, 'already there is a no-op');
  assert.throws(() => moveCompany({ slug: 'ghost', to: 'ashby' }), /No row for ghost/);
});
