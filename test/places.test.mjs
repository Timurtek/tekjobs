// Place tags from a posting's location text, and the location filter that reads them. The shapes here are
// the ones real boards write (Greenhouse, Ashby, Lever, Salesforce, Atlassian, HN), taken from a live vault.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'tekjobs-places-'));
process.env.TEKJOBS_PROFILE = vault;
const { P, ensureDirs } = await import('../scraper/config.mjs');
const { placesOf, countPlaces } = await import('../scraper/places.mjs');
const { filterJobs, jobFacets } = await import('../app/server/store.mjs');
ensureDirs();

const cases = [
  ['Remote · United States', ['Remote', 'United States']],
  ['Remote · USA', ['Remote', 'United States']],
  ['Remote - US', ['Remote', 'United States']],
  ['Remote U.S.', ['Remote', 'United States']],
  ['United States (Remote) ', ['Remote', 'United States']],
  ['US Remote', ['Remote', 'United States']],
  ['Remote · Anywhere in the World', ['Remote', 'Worldwide']],
  ['Remote job', ['Remote']],
  ['Flexible / Remote', ['Remote']],
  ['Seattle, WA', ['Seattle', 'Washington', 'United States']],
  ['Seattle, WA (Hybrid) or Remote (US)', ['Remote', 'Seattle', 'Washington', 'United States']],
  ['California - San Francisco Metro - Remote; New York - Remote', ['Remote', 'California', 'United States', 'San Francisco', 'New York']],
  ['San Francisco - United States -   San Francisco, California 94104 United States; Remote - Remote', ['Remote', 'San Francisco', 'United States', 'California']],
  ['US-CA-Menlo Park', ['United States', 'California', 'Menlo Park']],
  ['USA-NC', ['United States', 'North Carolina']],
  ['NYC or Remote', ['Remote', 'New York']],
  ['New York City; Washington DC; Washington', ['New York', 'Washington DC', 'United States', 'Washington']],
  ['Remote, Ontario; Remote, British Columbia', ['Remote', 'Ontario', 'Canada', 'British Columbia']],
  ['REMOTE (US/Canada)', ['Remote', 'United States', 'Canada']],
  ['Remote · EMEA,  LATAM,  Canada,  USA', ['Remote', 'EMEA', 'LATAM', 'Canada', 'United States']],
  ['Remote in Deutschland', ['Remote', 'Germany']],
  ['Hamburg, München, Düsseldorf, remote', ['Remote', 'Hamburg', 'München', 'Düsseldorf']],
  ['Bengaluru - India -   Bengaluru,  560071 India', ['Bengaluru', 'India']],
  ['McLean, VA; Virginia - Mclean', ['McLean', 'Virginia', 'United States']],
  ['1234 Mathilda Place, Ste 100, Sunnyvale, CA', ['Sunnyvale', 'California', 'United States']],
  ['Orlando, FL', ['Orlando', 'Florida', 'United States']],
  ['Remote-Friendly (Travel-Required) | San Francisco, CA', ['Remote', 'San Francisco', 'California', 'United States']],
  ['Western Australia', ['Western Australia']],
  ['', []],
];

test('placesOf reads the place tags boards mean, each spelled once', () => {
  for (const [text, want] of cases) assert.deepEqual(placesOf(text), want, JSON.stringify(text));
});

test('a very long list cut mid-word drops its tail', () => {
  const long = Array.from({ length: 30 }, (_, i) => `City${i}, CA`).join('; ') + '; Maryland - Wa';
  assert.ok(long.length >= 250);
  const p = placesOf(long);
  assert.ok(!p.includes('Wa'));
  assert.ok(p.includes('California'));
});

test('countPlaces counts a tag once per row', () => {
  assert.deepEqual(countPlaces([{ places: ['Remote', 'United States'] }, { places: ['United States'] }, { places: [] }]), { Remote: 1, 'United States': 2 });
});

// ---------- the filter on notes ----------
fs.mkdirSync(P.jobs, { recursive: true });
const note = (name, fm) => fs.writeFileSync(path.join(P.jobs, `${name}.md`), `---\n${Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n# ${name}\n`);
note('A - Design Engineer (1)', { company: '"A"', title: '"Design Engineer"', status: 'new', score: 100, found: '2026-10-01', location: '"Remote · USA"', remote: 'true' });
note('B - Design Engineer (2)', { company: '"B"', title: '"Design Engineer"', status: 'new', score: 90, found: '2026-10-01', location: '"Seattle, WA; New York, NY"', remote: 'false' });
note('C - Design Engineer (3)', { company: '"C"', title: '"Design Engineer"', status: 'new', score: 80, found: '2026-10-01', location: '"Remote in Deutschland"', remote: 'true' });
note('D - Design Engineer (4)', { company: '"D"', title: '"Design Engineer"', status: 'new', score: 70, found: '2026-10-01', location: '""', remote: 'false' });

test('the location filter takes a place tag, any of several, or a whole word in the text', () => {
  const ids = (f) => filterJobs(f).map((r) => r.company).sort();
  assert.deepEqual(ids({ location: 'United States' }), ['A', 'B'], 'the tag finds USA and the WA note alike');
  assert.deepEqual(ids({ location: 'united states' }), ['A', 'B'], 'case does not matter');
  assert.deepEqual(ids({ location: 'Washington' }), ['B']);
  assert.deepEqual(ids({ location: 'Germany, Seattle' }), ['B', 'C'], 'any of');
  assert.deepEqual(ids({ location: 'wa' }), ['B'], 'a whole word in the raw text still works, as saved views rely on');
  assert.deepEqual(ids({ location: 'Deutschland' }), ['C'], 'the raw word too');
  assert.deepEqual(ids({ location: '' }), ['A', 'B', 'C', 'D']);
  assert.deepEqual(ids({ location: 'Mars' }), []);
});

test('the facets list the places under the other filters, with the location filter itself lifted', () => {
  const f = jobFacets({ location: 'Germany' });
  assert.equal(f.total, 1);
  assert.deepEqual(f.location, { Remote: 2, 'United States': 2, Seattle: 1, Washington: 1, 'New York': 1, Germany: 1 });
  const g = jobFacets({ remoteOnly: true });
  assert.deepEqual(g.location, { Remote: 2, 'United States': 1, Germany: 1 });
});
