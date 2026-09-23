// Source health: what each board and feed did the last time the scan tried it, kept beside the scan's other
// state in the profile folder's .tekjobs/ (not in the Companies table, whose one Status cell stays a short
// human line for Obsidian). The scan records; the app reads and derives a state per source.
import fs from 'node:fs';
import { P } from './config.mjs';

export const STALE_DAYS = 3;

export function loadHealth() {
  try { return JSON.parse(fs.readFileSync(P.health, 'utf8')); } catch { return { boards: {}, feeds: {} }; }
}

export function saveHealth(h) {
  fs.mkdirSync(require_dir(P.health), { recursive: true });
  fs.writeFileSync(P.health, JSON.stringify(h, null, 2));
}
const require_dir = (file) => file.replace(/[\\/][^\\/]*$/, '');

/** Fold one fetch result into a source's record. `r` is the fetcher's own answer: ok, jobs, error, emptyBoard. */
export function record(prev = {}, r, now = new Date().toISOString()) {
  const jobs = r.ok ? r.jobs.length : null;
  if (!r.ok) return { ...prev, lastAttempt: now, lastError: r.error || 'failed', failStreak: (prev.failStreak || 0) + 1 };
  return {
    ...prev,
    lastAttempt: now, lastOk: now, lastError: '', failStreak: 0,
    lastJobs: jobs, lastOkJobs: jobs,
    zeroStreak: jobs === 0 ? (prev.zeroStreak || 0) + 1 : 0,
    everJobs: Math.max(prev.everJobs || 0, jobs),
  };
}

/**
 * One word for where a source stands: failed (its latest attempt failed), zero (answered, but with nothing,
 * which for a board that once had jobs usually means the slug moved), stale (no success in STALE_DAYS),
 * never (no attempt on record), ok. The Companies table's Status cell is the fallback for rows the health
 * file has not seen, so an old profile folder is not all "never" on the first day.
 */
export function healthState(h, statusCell = '', now = Date.now()) {
  if (!h || !h.lastAttempt) {
    if (/^bad-slug/.test(statusCell)) return 'failed';
    if (/0 jobs/.test(statusCell)) return 'zero';
    return statusCell ? 'ok' : 'never';
  }
  if (h.lastError && (!h.lastOk || h.lastAttempt >= h.lastOk)) return 'failed';
  if (!h.lastOk || now - Date.parse(h.lastOk) > STALE_DAYS * 864e5) return 'stale';
  if (h.lastOkJobs === 0) return 'zero';
  return 'ok';
}

export const STATES = ['failed', 'zero', 'stale', 'never', 'ok'];
