// A posting's own headings must not cut its description short. Until 2026-10 every reader ended the Job description
// at the first "## " line, and htmlToText writes every <h1>–<h6> as "## ", so most notes lost most of their
// description to the app, the MCP tools, the drafting prompts and rescoring.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { descriptionSection, demoteHeadings } from '../scraper/note-sections.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const note = (desc, after = '') => `---\ntitle: "X"\nscore: 10\n---\n\n# X @ Y\n\n## Why it matched\n- title +10\n\n## Status log\n- 2026-10-01 — found\n\n## Notes\n\n## Job description\n> Source: greenhouse\n\n${desc}\n${after}`;

test('the description runs past its own "## " headings to the end of the note', () => {
  const d = descriptionSection(note('Intro line.\n\n## About Contoso\n\nWe build safe AI.\n\n## What you will do\n\nShip the design system.'));
  assert.match(d, /Intro line/);
  assert.match(d, /We build safe AI/);
  assert.match(d, /Ship the design system/);
});

test('it stops at a TekJobs section a writer appended after it, and only at an exact one', () => {
  const d = descriptionSection(note('Body.\n\n## Notes on the team\n\nStill the posting.', '\n## Status log\n- 2026-10-02 — late line\n'));
  assert.match(d, /Still the posting/, '"## Notes on the team" is a posting heading, not the Notes section');
  assert.doesNotMatch(d, /late line/);
});

test('a note without a description gives an empty string', () => {
  assert.equal(descriptionSection('---\ntitle: X\n---\n\n## Why it matched\n- x\n'), '');
});

test('posting headings are demoted below the note\'s own sections', () => {
  assert.equal(demoteHeadings('# A\n## B\n### C\n#### D\n##### E\nnot # a heading\n#hashtag'), '### A\n#### B\n##### C\n###### D\n##### E\nnot # a heading\n#hashtag');
  assert.equal(descriptionSection(note(demoteHeadings('## About us\n\nText.'))).trim(), '> Source: greenhouse\n\n#### About us\n\nText.');
});

// The app and rescoring, on a copy of the fictional sample vault.
let store, rescore, vault, file;
before(async () => {
  vault = fs.mkdtempSync(path.join(os.tmpdir(), 'tekjobs-desc-'));
  fs.cpSync(path.join(ROOT, 'samples', 'vault'), vault, { recursive: true });
  process.env.TEKJOBS_PROFILE = vault;
  file = fs.readdirSync(path.join(vault, 'Jobs')).find((f) => f.startsWith('Northwind Labs'));
  const p = path.join(vault, 'Jobs', file);
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/\n*$/, '\n\n## About the team\n\nThe team ships a component library in Storybook every week.\n'));
  store = await import('../app/server/store.mjs');
  rescore = await import('../scraper/rescore.mjs');
});

test('the job the app and the MCP tools see carries the text after an inner heading', () => {
  const id = file.replace(/\.md$/, '');
  const job = store.getJob(id);
  assert.match(job.sections.description, /ships a component library in Storybook/);
  assert.match(job.sections.description, /Northwind Labs builds tools for warehouse operators/, 'and the text before it');
});

test('the new reading makes every note stale once, so a full rescore reads them again', () => {
  const r = rescore.rescoreFull({ dry: true });
  assert.ok(r.considered > 0);
  assert.equal(r.alreadyCurrent, 0, 'no note was stamped with a fingerprint that includes the new reading');
});
