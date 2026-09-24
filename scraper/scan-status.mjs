// The scan's status on disk, so it outlives the process that started it.
//
// The app server and the MCP server start a scan as a detached child whose output goes to a log file; the child
// writes a start record and a finish record here. Any later process (a new MCP server after a one-shot client's
// turn, the app after a restart) reads the same two files, so "is a scan running" and "what did it print" have
// one answer everywhere. A record with no finish and a pid that is gone means the process was killed: reported
// as not running, with a note, rather than as running forever.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.mjs';

export const statusFile = (dir = DATA_DIR) => path.join(dir, 'scan-status.json');
export const logFile = (dir = DATA_DIR) => path.join(dir, 'scan.log');

export function readStatus(dir = DATA_DIR) {
  try { return JSON.parse(fs.readFileSync(statusFile(dir), 'utf8')); } catch { return null; }
}

/** Merge a patch into the record; a start record (one with `started`) replaces what was there. */
export function writeStatus(patch, dir = DATA_DIR) {
  fs.mkdirSync(dir, { recursive: true });
  const prev = patch.started ? {} : (readStatus(dir) || {});
  const next = { ...prev, ...patch };
  fs.writeFileSync(statusFile(dir), JSON.stringify(next, null, 2));
  return next;
}

export function pidAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

/** The last `n` non-empty lines of a file; nothing when it does not exist. */
export function tail(file, n = 200) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return []; }
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  return lines.slice(-n);
}

/**
 * What the record means now. `alive` is injectable so a test can say what a pid is doing.
 * Shape kept from the in-memory version the app already reads: running, startedAt, finishedAt, exitCode,
 * output, criteria; plus pid, dry, via and a note when the process vanished.
 */
export function scanState(status, output = [], alive = pidAlive) {
  if (!status) return { running: false, startedAt: null, finishedAt: null, exitCode: null, output, criteria: '', pid: null, dry: false, via: '', note: '' };
  const finished = !!status.finished;
  const live = !finished && alive(status.pid);
  const gone = !finished && !live;
  return {
    running: live,
    startedAt: status.started || null,
    finishedAt: status.finished || null,
    exitCode: finished ? (status.exitCode ?? null) : (gone ? -1 : null),
    output,
    criteria: status.criteria || '',
    pid: status.pid || null,
    dry: !!status.dry,
    via: status.via || '',
    note: gone ? 'The scan process ended without writing a finish record (killed, or the machine slept). Start another.' : '',
  };
}
