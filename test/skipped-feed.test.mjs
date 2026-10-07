// An optional source with nothing to read is skipped, not failed. A QA run's first scan answered on every board
// and was still recorded as "Partial · 1 problem" because the empty Inbox/ counted as a failed feed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'tekjobs-skipped-'));
fs.cpSync(path.join(ROOT, 'samples', 'vault'), vault, { recursive: true });
process.env.TEKJOBS_PROFILE = vault;
const { fetchEmailInbox } = await import('../scraper/sources-email.mjs');
const { record, healthState } = await import('../scraper/health.mjs');
const store = await import('../app/server/store.mjs');

test('an absent or empty Inbox is a skip with a reason, and a real parse failure is still a failure', async () => {
  const missing = await fetchEmailInbox({ _inbox: path.join(vault, 'Inbox') });
  assert.equal(missing.ok, true);
  assert.deepEqual(missing.jobs, []);
  assert.match(missing.skipped, /no Inbox folder yet/);
  fs.mkdirSync(path.join(vault, 'Inbox'));
  const empty = await fetchEmailInbox({ _inbox: path.join(vault, 'Inbox') });
  assert.equal(empty.ok, true);
  assert.match(empty.skipped, /no \.eml files/);
  fs.writeFileSync(path.join(vault, 'Inbox', 'hello.eml'), 'From: a@example.test\nSubject: hello\n\nNo links here.\n');
  const noLinks = await fetchEmailInbox({ _inbox: path.join(vault, 'Inbox') });
  assert.equal(noLinks.ok, true);
  assert.match(noLinks.skipped, /no job links found in 1 message/);
  const unset = await fetchEmailInbox({});
  assert.equal(unset.ok, true);
  assert.match(unset.skipped, /no inbox folder configured/);
});

test('health records a skip without a failure streak or a zero, and a later success clears it', () => {
  const skipped = record({}, { ok: true, jobs: [], skipped: 'no .eml files' }, '2026-10-07T07:30:00Z');
  assert.equal(skipped.failStreak, 0);
  assert.equal(skipped.lastError, '');
  assert.equal(skipped.lastOk, undefined);
  assert.equal(healthState(skipped), 'never', 'not tried is the honest word; never failed, never zero');
  const later = record(skipped, { ok: true, jobs: [{ id: 'a' }] }, '2026-10-08T07:30:00Z');
  assert.equal(later.skipped, '');
  assert.equal(healthState(later, '', Date.parse('2026-10-08T08:00:00Z')), 'ok');
  const failed = record({}, { ok: false, error: 'HTTP 503' }, '2026-10-07T07:30:00Z');
  assert.equal(healthState(failed), 'failed', 'a real failure still reads as one');
});

test('a run whose only feed line is a skip reads as a success in the history; a failed feed still makes it partial', () => {
  fs.mkdirSync(path.join(vault, 'Logs'), { recursive: true });
  fs.writeFileSync(path.join(vault, 'Logs', '2026-12-01.md'), [
    '## Run 2026-12-01 07:30 UTC',
    '- Boards: 304/304 ok · postings scanned: 22556 · dropped by exclusions: 9000 · scored ≥ 45: 194 · **new: 194** · closed: 0 · 96.1s',
    '- Criteria: Search Criteria.md',
    '- Via: app',
    '- Email alerts: skipped (no .eml files in Inbox)',
    '- Himalayas: 120 postings',
    '',
    '## Run 2026-12-01 09:00 UTC',
    '- Boards: 304/304 ok · postings scanned: 22556 · scored ≥ 45: 194 · **new: 0** · closed: 0 · 96.1s',
    '- Via: app',
    '- Himalayas: failed: HTTP 503',
    '',
  ].join('\n'));
  const day = store.runs().find((d) => d.date === '2026-12-01');
  assert.ok(day, 'the log day is read');
  assert.equal(day.runs[0].outcome, 'success');
  assert.deepEqual(day.runs[0].feedsFailed || [], []);
  assert.equal(day.runs[1].outcome, 'partial');
  assert.match((day.runs[1].feedsFailed || []).join(' '), /Himalayas/);
});
