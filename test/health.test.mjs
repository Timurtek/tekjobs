import { test } from 'node:test';
import assert from 'node:assert/strict';
import { record, healthState } from '../scraper/health.mjs';

const day = 864e5;
const at = (d) => new Date(Date.UTC(2026, 8, 23) + d * day).toISOString();
const now = Date.UTC(2026, 8, 23) + 10 * day;

test('a failed fetch keeps the last success and counts the streak', () => {
  const ok = record({}, { ok: true, jobs: [1, 2, 3] }, at(0));
  const bad = record(ok, { ok: false, error: 'HTTP 404' }, at(1));
  assert.equal(bad.lastOk, at(0));
  assert.equal(bad.lastOkJobs, 3);
  assert.equal(bad.failStreak, 1);
  assert.equal(record(bad, { ok: false, error: 'timeout' }, at(2)).failStreak, 2);
  assert.equal(record(bad, { ok: true, jobs: [] }, at(2)).failStreak, 0);
});

test('states: failed when the latest attempt failed, zero when it answered with nothing, stale when no success in three days', () => {
  const okNow = record({}, { ok: true, jobs: [1] }, new Date(now).toISOString());
  assert.equal(healthState(okNow, '', now), 'ok');
  assert.equal(healthState(record(okNow, { ok: false, error: 'x' }, new Date(now).toISOString()), '', now), 'failed');
  assert.equal(healthState(record({}, { ok: true, jobs: [] }, new Date(now).toISOString()), '', now), 'zero');
  assert.equal(healthState(record({}, { ok: true, jobs: [1] }, at(0)), '', now), 'stale');
  // A board that failed today but succeeded yesterday is failed, not stale: the latest word wins.
  assert.equal(healthState(record(record({}, { ok: true, jobs: [1] }, new Date(now - day).toISOString()), { ok: false, error: 'x' }, new Date(now).toISOString()), '', now), 'failed');
});

test('without a health record the Companies table status cell decides', () => {
  assert.equal(healthState(undefined, 'bad-slug (HTTP 404)'), 'failed');
  assert.equal(healthState(undefined, 'ok · 0 jobs (slug?)'), 'zero');
  assert.equal(healthState(undefined, 'ok · 12'), 'ok');
  assert.equal(healthState(undefined, ''), 'never');
});
