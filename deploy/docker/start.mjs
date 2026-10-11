// The container's one process: the TekJobs server, and the daily run at TEKJOBS_SCAN_TIME on the container's clock
// (TZ). Outside a container the same jobs belong to `tekjobs up` and `tekjobs schedule`; here there is no Task
// Scheduler or crontab to hand them to, so this keeps both and sends their output to `docker logs`.
//
//   TEKJOBS_SCAN_TIME  HH:MM, or "off" for no daily run                                   (07:30)
//   TEKJOBS_DAILY      what the daily run does, in order: scan, mail, calendar, comma-separated   (scan)
//                      mail and calendar read through the Claude CLI's connectors, so add them only once it is signed in
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PROFILE = process.env.TEKJOBS_PROFILE || '/vault';
const STEPS = {
  scan: ['run.mjs'],
  mail: ['cli.mjs', 'mail'],
  calendar: ['cli.mjs', 'calendar', 'check'],
};
const log = (line) => console.log(`[tekjobs ${new Date().toISOString()}] ${line}`);

let empty = true;
try { empty = fs.readdirSync(PROFILE).filter((f) => !f.startsWith('.')).length === 0; } catch { /* not mounted */ }
if (empty) log(`The profile folder ${PROFILE} is empty. Start a search with: docker compose exec tekjobs tekjobs init  (or: tekjobs init --sample /vault, to look around first)`);

const server = spawn(process.execPath, [path.join(ROOT, 'app', 'server', 'index.mjs')], { cwd: ROOT, stdio: 'inherit' });
let stopping = false;
server.on('exit', (code, signal) => { log(`server stopped (${signal || code})`); process.exit(stopping ? 0 : code ?? 1); });

let timer = null;
let current = null;
const stop = (signal) => { stopping = true; clearTimeout(timer); current?.kill(signal); server.kill(signal); };
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));

function runStep(name) {
  return new Promise((resolve) => {
    log(`daily ${name}`);
    current = spawn(process.execPath, STEPS[name].map((a, i) => (i === 0 ? path.join(ROOT, a) : a)), {
      cwd: ROOT, stdio: 'inherit', env: { ...process.env, TEKJOBS_RUN_VIA: 'schedule' },
    });
    current.on('exit', (code) => { current = null; if (code) log(`daily ${name} exited with ${code}`); resolve(); });
    current.on('error', (e) => { current = null; log(`daily ${name} did not start: ${e.message}`); resolve(); });
  });
}

/** Milliseconds until the next HH:MM on this container's clock. */
function untilNext(hhmm, now = new Date()) {
  const [h, m] = hhmm.split(':').map(Number);
  const next = new Date(now);
  next.setHours(h, m, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next - now;
}

const time = String(process.env.TEKJOBS_SCAN_TIME || '07:30').trim();
const steps = String(process.env.TEKJOBS_DAILY || 'scan').split(',').map((s) => s.trim()).filter(Boolean);
const unknown = steps.filter((s) => !STEPS[s]);
if (time.toLowerCase() === 'off') log('daily run is off (TEKJOBS_SCAN_TIME=off)');
else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) log(`TEKJOBS_SCAN_TIME "${time}" is not HH:MM; the daily run is off`);
else if (unknown.length) log(`TEKJOBS_DAILY has ${unknown.join(', ')}, which is not scan, mail or calendar; the daily run is off`);
else {
  const schedule = () => {
    const ms = untilNext(time);
    log(`next daily run (${steps.join(', ')}) at ${time} ${process.env.TZ || 'UTC'}, in ${Math.round(ms / 60000)} minutes`);
    timer = setTimeout(async () => {
      for (const s of steps) await runStep(s);
      schedule();
    }, ms);
  };
  schedule();
}
