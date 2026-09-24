import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// config.mjs resolves the profile folder when it loads, so the temp folder goes into the environment first.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tekjobs-scan-status-'));
process.env.TEKJOBS_PROFILE = dir;
const { readStatus, writeStatus, scanState, tail, statusFile, logFile, pidAlive } = await import('../scraper/scan-status.mjs');
const data = path.join(dir, '.tekjobs');

test('a start record then a finish record round-trip through the file, and a start record replaces the old run', () => {
  assert.equal(readStatus(data), null);
  writeStatus({ pid: 4242, started: '2026-09-24T14:00:00.000Z', dry: true, criteria: '', via: 'mcp' }, data);
  assert.equal(readStatus(data).pid, 4242);
  writeStatus({ finished: '2026-09-24T14:02:05.000Z', exitCode: 0 }, data);
  const done = readStatus(data);
  assert.equal(done.started, '2026-09-24T14:00:00.000Z', 'the finish patch keeps the start fields');
  assert.equal(done.exitCode, 0);
  writeStatus({ pid: 4343, started: '2026-09-24T15:00:00.000Z', dry: false, via: 'app' }, data);
  const fresh = readStatus(data);
  assert.equal(fresh.finished, undefined, 'a new start record does not inherit the old finish');
  assert.equal(fresh.pid, 4343);
  assert.ok(fs.existsSync(statusFile(data)));
});

test('the state reads running only while the pid is alive and no finish record exists', () => {
  const started = { pid: 1, started: 'now', dry: true, via: 'mcp' };
  assert.equal(scanState(started, [], () => true).running, true);
  const gone = scanState(started, [], () => false);
  assert.equal(gone.running, false);
  assert.equal(gone.exitCode, -1);
  assert.match(gone.note, /without writing a finish record/);
  const finished = scanState({ ...started, finished: 'later', exitCode: 0 }, ['a', 'b'], () => true);
  assert.equal(finished.running, false);
  assert.equal(finished.exitCode, 0);
  assert.deepEqual(finished.output, ['a', 'b']);
  const nothing = scanState(null);
  assert.equal(nothing.running, false);
  assert.equal(nothing.startedAt, null);
});

test('the log tail keeps the last lines and skips blanks; a missing log is an empty list', () => {
  assert.deepEqual(tail(logFile(data)), []);
  fs.mkdirSync(data, { recursive: true });
  fs.writeFileSync(logFile(data), ['one', '', 'two', 'three', ''].join('\n'));
  assert.deepEqual(tail(logFile(data), 2), ['two', 'three']);
  assert.deepEqual(tail(logFile(data)), ['one', 'two', 'three']);
});

test('this process is alive to itself and a nonsense pid is not', () => {
  assert.equal(pidAlive(process.pid), true);
  assert.equal(pidAlive(0), false);
  assert.equal(pidAlive(2 ** 22 - 7), false);
});
