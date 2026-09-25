import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, table, companyKey, sameCompany, roleGuess, readExport, buildIndex, warmPaths, peopleCandidates, snippetSuggestions } from '../scraper/linkedin.mjs';
import { openZip } from '../scraper/zip.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const folder = path.join(here, 'fixtures', 'linkedin');
const zip = path.join(here, 'fixtures', 'linkedin-export.zip');

test('csv: quoted commas, doubled quotes and newlines inside cells', () => {
  const rows = parseCsv('a,b\n"x, y","say ""hi""\nthere"\n');
  assert.deepEqual(rows, [['a', 'b'], ['x, y', 'say "hi"\nthere']]);
});

test('connections.csv: the three-line note before the header is skipped', () => {
  const rows = table('Notes:\n"Some note."\n\nFirst Name,Last Name\nJane,Doe\n');
  assert.deepEqual(rows, [{ 'First Name': 'Jane', 'Last Name': 'Doe' }]);
});

test('company keys meet in the middle, and titles guess a role', () => {
  assert.equal(companyKey('Northwind Traders, Inc.'), companyKey('northwind traders'));
  assert.equal(companyKey('The Vanta Group LLC'), 'vanta');
  assert.equal(companyKey('Group O'), 'group o', 'a name the suffix rule would eat keeps its words');
  assert.equal(companyKey('Amazon.jobs'), 'amazon');
  assert.equal(companyKey('google.com'), 'google');
  assert.equal(sameCompany('amazon', 'amazon web services'), true);
  assert.equal(sameCompany('o', 'contoso'), false, 'a short key never matches by containment');
  assert.equal(sameCompany('vanta', 'advantage'), false);
  assert.equal(roleGuess('Senior Technical Recruiter'), 'recruiter');
  assert.equal(roleGuess('Engineering Manager'), 'hiring-manager');
  assert.equal(roleGuess('Design Engineer'), 'other');
});

test('the zip reader opens the fixture archive and reads a deflated entry', () => {
  const z = openZip(zip);
  assert.ok(z.has('Connections.csv'), z.names.join(', '));
  assert.match(z.readText('Connections.csv'), /Jane,Doe/);
});

for (const [kind, source] of [['folder', folder], ['zip', zip]]) {
  test(`the ${kind} export reads into tables and an index`, () => {
    const ex = readExport(source);
    assert.equal(ex.connections.length, 4);
    assert.equal(ex.messages.length, 3);
    assert.equal(ex.answers.length, 5, 'saved answers and screening responses both count');
    const index = buildIndex(ex, { since: '2026-06-01', now: new Date('2026-09-25T00:00:00Z') });
    assert.equal(index.self, 'Avery Sample');
    assert.equal(index.counts.connections, 4);
    assert.equal(index.threads.length, 1, 'the 2021 thread is before since');
    assert.equal(index.threads[0].with[0].company, 'Northwind Traders, Inc.', 'the sender is joined to their connection record');
    assert.equal(index.applications.length, 2);
    assert.equal(index.applications[0].date, '2026-09-15');
    assert.equal(index.answers.length, 4, 'the duplicate salary question is kept once');
    assert.equal(index.preferences.titles, 'Design Engineer;Design Systems Engineer');
  });
}

test('warm paths: who you know at a company, recruiters first, by loose company match', () => {
  const index = buildIndex(readExport(folder), { since: '2026-06-01' });
  const w = warmPaths(index, 'Northwind Traders');
  assert.equal(w.count, 2);
  assert.equal(w.people[0].name, 'Jane Doe');
  assert.equal(w.people[0].role, 'recruiter');
  assert.equal(warmPaths(index, 'Fabrikam Inc').count, 1);
  assert.equal(warmPaths(index, 'Nobody Corp').count, 0);
});

test('people candidates: senders and inviters since the date, never yourself, with the connection title', () => {
  const index = buildIndex(readExport(folder), { since: '2026-06-01' });
  const c = peopleCandidates(index);
  assert.deepEqual(c.map((p) => p.name), ['Mina Park', 'Jane Doe']);
  const jane = c.find((p) => p.name === 'Jane Doe');
  assert.equal(jane.role, 'recruiter');
  assert.equal(jane.company, 'Northwind Traders, Inc.');
  assert.equal(jane.count, 1, 'only her message counts, not the reply');
  assert.match(jane.log[0].text, /Staff Design Engineer at Northwind/);
  assert.equal(c.find((p) => p.name === 'Mina Park').log[0].via, 'linkedin invitation received');
});

test('snippet suggestions skip yes/no answers and labels the panel already has', () => {
  const index = buildIndex(readExport(folder));
  const s = snippetSuggestions(index, [{ group: 'Answers', label: 'What is your desired salary', value: 'x' }]);
  // Files are read in name order, so the screening responses come before Jobs/Job Applicant Saved Answers.
  assert.deepEqual(s.map((x) => x.label), ['How many years of experience do you have with design systems', 'Website']);
  assert.equal(s[0].group, 'From LinkedIn');
});
