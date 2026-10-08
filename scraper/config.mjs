import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * The calendar day as YYYY-MM-DD, in this machine's own time zone. Every date the product stamps into the
 * record (a note's found date, a status-log line, a log file's name, the journal's day, a backup's suffix)
 * uses this, so an evening decision lands in the day the person made it. Until 2026-10-08 these used the UTC
 * day, which in the US Pacific evening is already tomorrow; dates already written are left as they are.
 */
export function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const HOME_DIR = path.join(os.homedir(), '.tekjobs');
export const CONFIG_FILE = path.join(HOME_DIR, 'config.json');

/**
 * The profile folder is the database: profile, resume, criteria, watchlist, job notes, logs.
 * Resolution order: TEKJOBS_PROFILE (or the older TEKJOBS_VAULT) → ~/.tekjobs/config.json {"profile": …} → ~/.tekjobs/profile.
 */
export function resolveProfileDir() {
  if (process.env.TEKJOBS_PROFILE) return path.resolve(process.env.TEKJOBS_PROFILE);
  if (process.env.TEKJOBS_VAULT) return path.resolve(process.env.TEKJOBS_VAULT);
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    if (cfg.profile) return path.resolve(cfg.profile);
  } catch { /* no config yet */ }
  return path.join(HOME_DIR, 'profile');
}
export function rememberProfileDir(dir) {
  fs.mkdirSync(HOME_DIR, { recursive: true });
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { /* fresh */ }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...cfg, profile: path.resolve(dir) }, null, 2));
}

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return {}; }
}

/**
 * The user agent on every request the tool makes: what it is, where the code lives, and how a site can reach
 * the person running it when ~/.tekjobs/config.json sets {"contact": "you@example.com"}.
 */
export const UA = `TekJobs/1.0 (personal job search tool; +https://github.com/Timurtek/tekjobs${readConfig().contact ? `; contact ${readConfig().contact}` : ''})`;

export const VAULT = resolveProfileDir();
export const PROFILE_DIR = VAULT;
/** Scan state lives inside the profile so a profile folder is self-contained and portable. */
export const DATA_DIR = path.join(VAULT, '.tekjobs');

/**
 * Settings that belong to one person's search, kept inside the profile folder: the resume of record and the folder
 * of resume variants. They used to live in ~/.tekjobs/config.json, which every profile on the machine read, so a
 * second profile (the sample, a test persona) saw the first person's resume files. Now the machine config says only
 * where the profile is, which CLI writes, and whom to contact; an older install's resume settings are adopted into
 * the profile they were saved for (the one the machine config points at) the first time they are read, and are
 * never applied to any other profile.
 */
export const PROFILE_SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
export function readProfileSettings() {
  try { return JSON.parse(fs.readFileSync(PROFILE_SETTINGS_FILE, 'utf8')); } catch { return {}; }
}
export function writeProfileSettings(patch) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const next = { ...readProfileSettings(), ...patch };
  for (const k of Object.keys(next)) if (next[k] === '' || next[k] === null || next[k] === undefined) delete next[k];
  fs.writeFileSync(PROFILE_SETTINGS_FILE, JSON.stringify(next, null, 2));
  return next;
}
export function profileSettings() {
  const own = readProfileSettings();
  if (own.resumeSource || own.resumeDir || own.adopted) return own;
  const cfg = readConfig();
  if (!cfg.resumeSource && !cfg.resumeDir) return own;
  const savedFor = cfg.profile ? path.resolve(cfg.profile) : '';
  if (savedFor !== VAULT) return own; // another profile's settings: not ours to read
  const adopted = writeProfileSettings({ resumeSource: cfg.resumeSource || '', resumeDir: cfg.resumeDir || '', adopted: localDay() });
  const { resumeSource, resumeDir, ...machine } = cfg;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(machine, null, 2));
  return adopted;
}

export const P = {
  profile: path.join(VAULT, 'Profile', 'Profile.md'),
  profileDir: path.join(VAULT, 'Profile'),
  criteria: path.join(VAULT, 'Targets', 'Search Criteria.md'),
  // Named criteria sets. The scan runs with Search Criteria.md unless told `--criteria <name>`.
  criteriaDir: path.join(VAULT, 'Targets', 'Criteria'),
  companies: path.join(VAULT, 'Targets', 'Companies.md'),
  jobs: path.join(VAULT, 'Jobs'),
  inbox: path.join(VAULT, 'Inbox'),
  logs: path.join(VAULT, 'Logs'),
  home: path.join(VAULT, '_Home.md'),
  seen: path.join(DATA_DIR, 'seen.json'),
  lastRun: path.join(DATA_DIR, 'last-run.json'),
  runsLog: path.join(DATA_DIR, 'runs.log'),
  // What each board and feed did the last time the scan tried it (scraper/health.mjs).
  health: path.join(DATA_DIR, 'board-health.json'),
  // The index the LinkedIn import builds: connections by company, threads by person (scraper/linkedin.mjs).
  linkedin: path.join(DATA_DIR, 'linkedin.json'),
};

export const ALL_ATS = ['greenhouse', 'lever', 'ashby', 'workday', 'rippling', 'smartrecruiters', 'workable', 'bamboohr', 'breezy', 'personio', 'teamtailor', 'eightfold', 'atlassian', 'github', 'spotify', 'amazon', 'google', 'apple'];

export function ensureDirs() {
  for (const d of [DATA_DIR, P.jobs, P.inbox, P.logs, P.profileDir, path.dirname(P.criteria)]) fs.mkdirSync(d, { recursive: true });
}

/** Criteria live in a ```json fence inside Targets/Search Criteria.md */
export function parseCriteriaNote(md, label = 'Search Criteria') {
  const m = md.match(/```json\s*\n([\s\S]*?)\n```/);
  if (!m) throw new Error(`No \`\`\`json block found in ${label}`);
  try {
    return JSON.parse(m[1]);
  } catch (e) {
    throw new Error(`${label} JSON is invalid: ${e.message}`);
  }
}
/** The active criteria, or any criteria note when given its path. */
export function loadCriteria(file = P.criteria) {
  return parseCriteriaNote(fs.readFileSync(file, 'utf8'), file);
}
/** Where a named preset lives. The name is used as the file name, so the characters a file name cannot hold are dropped. */
export function criteriaPresetFile(name) {
  const safe = String(name || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!safe) throw Object.assign(new Error('A preset needs a name.'), { status: 400 });
  return path.join(P.criteriaDir, `${safe}.md`);
}

/** Companies live in a markdown table: | Company | ATS | Slug | Tier | Status | Notes | */
export function loadCompanies() {
  const md = fs.readFileSync(P.companies, 'utf8');
  const rows = [];
  for (const line of md.split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 3) continue;
    const [name, ats, slug, tier = '', status = '', notes = ''] = cells;
    if (!name || name.toLowerCase() === 'company') continue;
    if (/^-+$/.test(name)) continue;
    const atsNorm = ats.toLowerCase();
    if (!ALL_ATS.includes(atsNorm)) continue;
    rows.push({ name, ats: atsNorm, slug, tier, status, notes });
  }
  return rows;
}

/** Rewrite the Status column of the companies table with fetch results, in place. */
export function writeCompanyStatuses(statusBySlug) {
  const md = fs.readFileSync(P.companies, 'utf8');
  const out = md.split(/\r?\n/).map((line) => {
    if (!line.trim().startsWith('|')) return line;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 6) return line;
    const [name, ats, slug] = cells;
    const key = `${ats.toLowerCase()}:${slug}`;
    if (!(key in statusBySlug)) return line;
    cells[4] = statusBySlug[key];
    return `| ${cells.join(' | ')} |`;
  });
  fs.writeFileSync(P.companies, out.join('\n'));
}
