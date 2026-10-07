import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.TEKJOBS_PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'tekjobs-llm-'));
const { classifyRun } = await import('../app/server/cover-letter.mjs');

test('a run that answered is an answer, whatever the answer says', () => {
  const out = '[{"company":"Northwind","role":"Staff Design Engineer","kind":"confirmation","gist":"Thanks for applying; benefits include a 401(k) match and OAuth-based SSO."}]';
  assert.equal(classifyRun({ code: 0, out, err: '' }), null);
  assert.equal(classifyRun({ code: 0, out, err: 'some warning mentioning oauth scopes' }), null, 'stderr chatter on a successful run is not a sign-out');
});

test('a signed-out CLI is recognised from what it says on stderr, with its words kept', () => {
  const e = classifyRun({ code: 1, out: '', err: 'Not logged in · Please run /login' });
  assert.equal(e.kind, 'auth');
  assert.match(e.message, /signed out/);
  assert.match(e.message, /Please run \/login/);
  assert.equal(classifyRun({ code: 1, out: '', err: 'API Error: 401 Unauthorized' }).kind, 'auth');
  assert.equal(classifyRun({ code: 1, out: '', err: 'OAuth token has expired' }).kind, 'auth');
});

test('a missing command, an outdated one, and any other failure keep their own kinds', () => {
  assert.equal(classifyRun({ code: 1, out: '', err: "'claude' is not recognized as an internal or external command" }).kind, 'missing');
  assert.equal(classifyRun({ code: 127, out: '', err: 'claude: command not found' }).kind, 'missing');
  assert.equal(classifyRun({ code: 1, out: '', err: 'This version requires a newer version of the CLI' }).kind, 'outdated');
  const f = classifyRun({ code: 1, out: '', err: 'something else broke\nlast line' });
  assert.equal(f.kind, 'failed');
  assert.match(f.message, /exited with code 1: something else broke last line/);
});
