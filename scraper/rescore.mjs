// Apply a change in scoring weights to notes that already exist.
//
// Scores are written into a note's frontmatter when the note is created and never recomputed, so a change to
// the criteria only reaches matches found after it. This brings the existing ones forward.
//
// It does NOT re-run scoreJob against the note. It cannot: a note stores at most `maxDescriptionChars` of the
// posting, so on this vault 194 of 338 open notes hold less text than the scan scored them on, and rescoring
// from the note would quietly lower every one of them. Instead it recomputes only the three components that
// are exactly derivable from frontmatter — title, recency and pay — and applies the difference to the stored
// score. Everything else (description keywords, seniority, location) is unchanged by a weight edit and
// cancels out, so the arithmetic is exact rather than approximate.
//
// Recency is measured at the age the posting had when it was found, not today's age. The stored score is a
// snapshot taken at discovery; re-dating it would make every score drift daily and mean something different
// from the number beside it in an older note.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { P, loadCriteria } from './config.mjs';
import { scoreJob } from './score.mjs';

/**
 * A short fingerprint of every criteria key the scorer reads.
 *
 * Stamped into a note as `weights:` so a note knows which rules produced its score. Without it a rescore has
 * no way to tell an already-adjusted note from an untouched one, and running the command twice would apply
 * the same delta twice — which is exactly the kind of quiet corruption this vault's never-rewrite rule
 * exists to prevent.
 */
export function weightsFingerprint(c = {}) {
  const relevant = {
    titleTerms: c.titleTerms, titleExclude: c.titleExclude, titleExtraPer: c.titleExtraPer,
    titleExtraCap: c.titleExtraCap, noTitleMatchPenalty: c.noTitleMatchPenalty,
    seniority: c.seniority, descTerms: c.descTerms, descCap: c.descCap,
    location: c.location, salary: c.salary, recency: c.recency,
  };
  // Keys sorted at every level. (An array replacer in JSON.stringify whitelists keys at every depth too, so
  // the earlier `JSON.stringify(relevant, topLevelKeys)` dropped nearly all the nested values: a criteria
  // set with a different pay floor or different title weights hashed the same. Found 2026-09-22 when a
  // preset with a 180k floor reported itself identical to the 220k active set.)
  const stable = JSON.stringify(sortKeys(relevant));
  return crypto.createHash('sha1').update(stable).digest('hex').slice(0, 8);
}
const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Title points under one set of weights. `extraCap` null means the old, uncapped behaviour. */
export function titlePoints(title = '', c = {}, extraCap) {
  const hits = Object.entries(c.titleTerms || {})
    .filter(([t]) => title.toLowerCase().includes(t.toLowerCase()))
    .sort((a, b) => b[1] - a[1]);
  if (!hits.length) return c.noTitleMatchPenalty ?? -40;
  const per = c.titleExtraPer ?? 5;
  const extra = (hits.length - 1) * per;
  return hits[0][1] + (extraCap == null ? extra : Math.min(extra, extraCap));
}

/** Recency points for an age in days. `withDays2` false reproduces the old four-bucket scale. */
export function recencyPoints(days, r = {}, withDays2 = true) {
  if (!Number.isFinite(days)) return 0;
  if (withDays2 && days <= 2) return r.days2 ?? r.days7 ?? 0;
  if (days <= 7) return r.days7 ?? 0;
  if (days <= 30) return r.days30 ?? 0;
  if (days <= 90) return r.days90 ?? 0;
  return r.older ?? 0;
}

/** Pay points. `scaled` false reproduces the old flat bonus for clearing the floor. */
export function payPoints(salaryMax, S = {}, scaled = true) {
  if (!S.minAnnual || !salaryMax) return 0;
  if (salaryMax >= S.minAnnual) {
    const base = S.meetsBonus ?? 10;
    if (!scaled) return base;
    const over = Math.max(0, salaryMax - S.minAnnual);
    return base + Math.min(Math.round((over / 10000) * (S.abovePer10k ?? 1)), S.aboveCap ?? 15);
  }
  if (S.stretchAnnual && salaryMax >= S.stretchAnnual) return S.stretchPenalty ?? -8;
  return S.belowPenalty ?? -30;
}

/**
 * @param {object} opts
 * @param {boolean} opts.dry   report without writing
 * @param {object}  opts.before the criteria the existing scores were computed under
 * @param {object}  [opts.now]  the criteria to move to; the active note when omitted. A preview passes a
 *                              proposed set here with dry=true and reads `changes` without writing anything.
 */
export function rescore({ dry = false, before = null, stampOnly = false, now: proposed = null } = {}) {
  const now = proposed || loadCriteria();
  const fingerprint = weightsFingerprint(now);

  // Record the current weights against every note without touching a score. For a vault whose notes were
  // brought forward some other way, so the first real rescore does not adjust them a second time.
  if (stampOnly) {
    const files = fs.readdirSync(P.jobs).filter((f) => f.endsWith('.md'));
    let stamped = 0;
    for (const f of files) {
      const file = path.join(P.jobs, f);
      const text = fs.readFileSync(file, 'utf8');
      if (new RegExp(`^weights: ${fingerprint}$`, 'm').test(text)) continue;
      if (!dry) fs.writeFileSync(file, stampWeights(text, fingerprint));
      stamped++;
    }
    return { total: files.length, changed: stamped, changes: [], fingerprint, stampOnly: true };
  }

  // `before` is required, and deliberately has no default.
  //
  // A note records the score it was given but not the weights that produced it, so nothing here can work out
  // what has already been applied. Guessing the previous weights from the current ones would make the command
  // silently double-apply on a second run and quietly corrupt every score in the vault. Until a note carries
  // a fingerprint of the weights that scored it, the caller has to say what changed.
  if (!before) {
    throw Object.assign(
      new Error('rescore needs the previous criteria: a note does not record which weights scored it, so running without them would double-apply. Pass --from <old-criteria.json>.'),
      { status: 400 },
    );
  }
  const old = before;

  const files = fs.readdirSync(P.jobs).filter((f) => f.endsWith('.md'));
  const changes = [];
  for (const f of files) {
    const file = path.join(P.jobs, f);
    let text = fs.readFileSync(file, 'utf8');
    const fm = (k) => (text.match(new RegExp('^' + k + ': (.*)$', 'm')) || [, ''])[1].replace(/^"|"$/g, '').trim();
    const stored = num(fm('score'));
    if (!stored) continue;
    // Already at these weights: nothing to do, and re-applying the delta would be the bug.
    if (fm('weights') === fingerprint) continue;

    const title = fm('title');
    const posted = fm('posted');
    const found = fm('found');
    // The age the posting had when the scan scored it, not its age today.
    const ageAtScan = posted && found ? (Date.parse(found) - Date.parse(posted)) / 864e5 : NaN;
    const salaryMax = num(fm('salary_max'));

    const delta =
      (titlePoints(title, now, now.titleExtraCap ?? 10) - titlePoints(title, old, old.titleExtraCap)) +
      (recencyPoints(ageAtScan, now.recency, true) - recencyPoints(ageAtScan, old.recency, false)) +
      (payPoints(salaryMax, now.salary, true) - payPoints(salaryMax, old.salary, false));

    const updated = Math.round(stored + delta);
    if (delta) changes.push({ file: f, company: fm('company'), title, stored, updated, delta });
    if (!dry) {
      // The stamp is written even when the delta is zero: the note is at these weights either way, and
      // recording that is what makes a second run a no-op.
      fs.writeFileSync(file, stampWeights(text.replace(/^score: .*$/m, `score: ${updated}`), fingerprint));
    }
  }
  return { total: files.length, changed: changes.length, changes, fingerprint };
}

/**
 * Score every note again from what the note holds, under the current criteria (or a proposed set).
 *
 * This is the rescore for a rule change the delta method cannot express: location terms, penalties,
 * description keywords, seniority words. The job is rebuilt from the note's frontmatter and its Job description
 * section and put through scoreJob with recency judged at the day the note was found. One component is
 * carried over rather than recomputed: description points on a note whose description was truncated at
 * write time, because the scan saw more text than the note keeps and re-reading the shorter text would lower
 * the score for no change in the rules. Notes already stamped with the target weights are left alone.
 *
 * Writes, when not dry: `score:`, `pay_band:`, `weights:`, the "Why it matched" section, and a Status log line
 * on every note whose score moved. Nothing else in the note is touched.
 */
export function rescoreFull({ dry = false, now: proposed = null } = {}) {
  const criteria = proposed || loadCriteria();
  const fingerprint = weightsFingerprint(criteria);
  const files = fs.readdirSync(P.jobs).filter((f) => f.endsWith('.md'));
  const changes = [];
  let seen = 0, skipped = 0;
  for (const f of files) {
    const file = path.join(P.jobs, f);
    let text = fs.readFileSync(file, 'utf8');
    const fm = (k) => (text.match(new RegExp('^' + k + ': (.*)$', 'm')) || [, ''])[1].replace(/^"|"$/g, '').trim();
    if (fm('weights') === fingerprint) { skipped++; continue; }
    if (!/^score: /m.test(text)) continue;
    seen++;
    const section = (h) => (text.match(new RegExp(`^## ${h}[ \\t]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm')) || [, ''])[1];
    const descRaw = section('Job description');
    const truncated = /^>.*truncated/m.test(descRaw);
    const description = descRaw.replace(/^>.*$/gm, '').trim();
    const stored = num(fm('score'));
    const found = fm('found');
    const job = {
      title: fm('title'), company: fm('company'), location: fm('location'), remote: fm('remote') === 'true',
      descriptionText: description, salary: fm('salary'), salaryMax: num(fm('salary_max')), posted: fm('posted') || null, department: fm('department'),
    };
    // The scan runs in the morning; a date-only `found` would put it at midnight and shift a two-day-old
    // posting into the fresher tier, so the scan's own hour is assumed.
    const scored = scoreJob(job, criteria, { now: found ? Date.parse(found) + 14.5 * 3600e3 : Date.now() });
    let score = scored.score;
    let reasons = scored.reasons;
    // A note that holds less than the scan read (truncated, or no description at all, as some boards give
    // none through their API) keeps the description points the scan awarded.
    if ((truncated || !description) && !scored.excluded) {
      const oldLine = (section('Why it matched').match(/^- (description \+(\d+):.*)$/m) || []);
      const newLine = reasons.findIndex((r) => r.startsWith('description +'));
      const newPts = newLine >= 0 ? num((reasons[newLine].match(/\+(\d+)/) || [])[1]) : 0;
      if (oldLine[1]) {
        score = Math.round(score - newPts + num(oldLine[2]));
        const kept = `${oldLine[1]} (kept from the scan; the note holds part of the posting)`;
        if (newLine >= 0) reasons[newLine] = kept; else reasons.splice(Math.min(3, reasons.length), 0, kept);
      }
    }
    const delta = score - stored;
    if (delta) changes.push({ file: f, company: job.company, title: job.title, stored, updated: score, delta, status: fm('status') });
    if (!dry) {
      text = text.replace(/^score: .*$/m, `score: ${score}`);
      if (/^pay_band: /m.test(text)) text = text.replace(/^pay_band: .*$/m, `pay_band: ${scored.payBand || 'unknown'}`);
      text = stampWeights(text, fingerprint);
      const why = `## Why it matched\n${reasons.map((r) => `- ${r}`).join('\n')}\n\n`;
      text = /^## Why it matched[ \t]*\n/m.test(text) ? text.replace(/^## Why it matched[ \t]*\n[\s\S]*?(?=^## |(?![\s\S]))/m, () => why) : text;
      if (delta) text = appendUnder(text, 'Status log', `- ${new Date().toISOString().slice(0, 10)} — rescored ${stored} → **${score}** with criteria ${fingerprint} (via cli)`);
      fs.writeFileSync(file, text);
    }
  }
  changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return { total: files.length, considered: seen, alreadyCurrent: skipped, changed: changes.length, changes, fingerprint, full: true };
}

function appendUnder(text, heading, line) {
  const re = new RegExp(`(^## ${heading}[ \\t]*\\n)([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm');
  if (!re.test(text)) return text.trimEnd() + `\n\n## ${heading}\n${line}\n`;
  return text.replace(re, (all, h, content) => { const body = content.trim(); return `${h}${body ? body + '\n' : ''}${line}\n\n`; });
}

/** Set or replace the `weights:` frontmatter line, without disturbing anything else. */
function stampWeights(text, fingerprint) {
  return /^weights: .*$/m.test(text)
    ? text.replace(/^weights: .*$/m, `weights: ${fingerprint}`)
    : text.replace(/^(score: .*)$/m, `$1\nweights: ${fingerprint}`);
}
