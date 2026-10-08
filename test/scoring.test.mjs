// The heart of the product: fictional postings in, expected scores, reasons, pay bands and note files out,
// against the sample vault's criteria (the set the interview writes for a design engineer).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'tekjobs-scoring-'));
fs.cpSync(path.join(ROOT, 'samples', 'vault'), vault, { recursive: true });
process.env.TEKJOBS_PROFILE = vault;
const { loadCriteria, P, ensureDirs } = await import('../scraper/config.mjs');
const { scoreJob, parseSalary, normalizeTitle } = await import('../scraper/score.mjs');
const { writeJobNote, jobNotePath, readFrontmatter } = await import('../scraper/vault.mjs');
ensureDirs();
const c = loadCriteria();
const now = Date.parse('2026-09-25T12:00:00Z');
const day = (n) => new Date(now - n * 864e5).toISOString();

const posting = (over = {}) => ({
  id: 'fx-1', company: 'Northwind Traders', title: 'Staff Design Engineer', location: 'Remote - United States', remote: true, source: 'greenhouse',
  url: 'https://boards.greenhouse.io/northwind/jobs/1', posted: day(1), salary: '$200,000 - $250,000', salaryMin: 200000, salaryMax: 250000,
  descriptionText: 'You will own the design system: React, TypeScript, tokens, Storybook, Figma, accessibility.', ...over,
});

test('parseSalary reads the usual shapes and ignores hourly rates and junk', () => {
  assert.deepEqual(parseSalary('$180,000 - $250,000 a year'), { min: 180000, max: 250000 });
  assert.deepEqual(parseSalary('$180k–$250k'), { min: 180000, max: 250000 });
  assert.deepEqual(parseSalary('Base pay range $210K to $280K USD'), { min: 210000, max: 280000 });
  assert.equal(parseSalary('$45 - $60 per hour'), null);
  assert.equal(parseSalary('equity 0.1% - 0.5%'), null);
  assert.equal(parseSalary('no numbers here'), null);
});

test('a strong match clears the bar with a reason for every point, and a title exclusion drops a job outright', () => {
  const s = scoreJob(posting(), c, { now });
  assert.ok(s.score >= c.minScore, `score ${s.score} clears minScore ${c.minScore}`);
  assert.equal(s.excluded, false);
  assert.equal(s.payBand, 'floor');
  const text = s.reasons.join('\n');
  assert.match(text, /^title \+\d+: .*design engineer/m);
  assert.match(text, /seniority \+\d+ \(staff\)/);
  assert.match(text, /description \+\d+: .*react/);
  assert.match(text, /remote \+\d+/);
  assert.match(text, /pay range tops out at \$250k, at or above floor/);
  assert.match(text, /posted 1d ago \(\+\d+\)/);
  const intern = scoreJob(posting({ title: 'Design Engineer Intern' }), c, { now });
  assert.equal(intern.excluded, true);
  assert.equal(intern.score, -999);
  assert.match(intern.reasons[0], /excluded by title/);
});

test('title abbreviations are spelled out before matching, and a company exclusion drops a posting the title would not', () => {
  // A first-run test let "Sr. Dir, Design" past a "director" exclusion and "Casino Alpha" past every title rule.
  assert.equal(normalizeTitle('Sr. Dir, Design Engineering'), 'senior director, design engineering');
  assert.equal(normalizeTitle('Eng Mgr, Platform'), 'engineer manager, platform');
  assert.equal(normalizeTitle('Senior SWE'), 'senior software engineer');
  assert.equal(normalizeTitle('Transfer Pricing Analyst'), 'transfer pricing analyst', 'letters inside words are left alone');
  const withDirector = { ...c, titleExclude: [...(c.titleExclude || []), 'director'] };
  const dir = scoreJob(posting({ title: 'Sr. Dir, Design Engineering' }), withDirector, { now });
  assert.equal(dir.excluded, true);
  assert.match(dir.reasons[0], /excluded by title: "director"/);
  const sr = scoreJob(posting({ title: 'Sr. Design Engineer' }), c, { now });
  assert.match(sr.reasons.join('\n'), /seniority \+\d+ \(senior\)/, 'the abbreviation earns the seniority boost');
  const casino = scoreJob(posting({ company: 'Casino Alpha' }), { ...c, companyExclude: ['casino', 'staffing'] }, { now });
  assert.equal(casino.excluded, true);
  assert.equal(casino.score, -999);
  assert.match(casino.reasons[0], /excluded by company: "casino"/);
  assert.equal(scoreJob(posting({ company: 'Casino Alpha' }), { ...c, companyExclude: [] }, { now }).excluded, false, 'without the key nothing changes');
});

test('the pieces move the score the way the docs say: no title match, not remote, stretch and below-floor pay, staleness', () => {
  const base = scoreJob(posting(), c, { now }).score;
  const noTitle = scoreJob(posting({ title: 'Account Manager, Design' }), c, { now });
  assert.ok(noTitle.score < base - 30, `no title match falls far: ${noTitle.score} vs ${base}`);
  assert.match(noTitle.reasons.join(' '), /no title match -\d+/);
  const office = scoreJob(posting({ remote: false, location: 'San Francisco, CA' }), c, { now });
  assert.ok(office.score < base, 'an office role scores under the remote one');
  const stretch = scoreJob(posting({ salaryMax: 185000, salary: '$160,000 - $185,000' }), c, { now });
  assert.equal(stretch.payBand, 'stretch');
  assert.ok(stretch.score < base);
  const below = scoreJob(posting({ salaryMax: 120000, salary: '$100,000 - $120,000' }), c, { now });
  assert.equal(below.payBand, 'below');
  assert.ok(below.score < stretch.score);
  const unknownPay = scoreJob(posting({ salaryMax: 0, salary: '' }), c, { now });
  assert.equal(unknownPay.payBand, 'unknown');
  const stale = scoreJob(posting({ posted: day(120) }), c, { now });
  assert.ok(stale.score < base, 'a four-month-old posting scores under a fresh one');
  const descCap = scoreJob(posting({ descriptionText: Object.keys(c.descTerms).join(' ').repeat(3) }), c, { now });
  const descPts = Number((descCap.reasons.join('\n').match(/description \+(\d+)/) || [])[1]);
  assert.ok(descPts <= c.descCap, `description points are capped at ${c.descCap}, got ${descPts}`);
});

test('a scored posting becomes a note with the frontmatter the app reads, and an existing note is never overwritten', () => {
  const job = posting({ id: 'fx-note-1' });
  const scored = scoreJob(job, c, { now });
  const file = writeJobNote(job, scored, c);
  assert.equal(file, jobNotePath(job));
  assert.ok(fs.existsSync(file));
  const fm = readFrontmatter(file);
  assert.equal(fm.type, 'job');
  assert.equal(fm.status, 'new');
  assert.equal(fm.listing, 'open');
  assert.equal(fm.company, 'Northwind Traders');
  assert.equal(fm.title, 'Staff Design Engineer');
  assert.equal(Number(fm.score), scored.score);
  assert.equal(fm.pay_band, 'floor');
  assert.equal(fm.remote, 'true');
  assert.ok(fm.weights, 'the note carries the criteria fingerprint');
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /## Why it matched\n- title \+/);
  assert.match(text, /## Status log\n- \d{4}-\d{2}-\d{2} — found by scraper/);
  assert.match(text, /## Application\n- \*\*Narrative:\*\*/);
  fs.writeFileSync(file, text.replace('status: new', 'status: applied'));
  writeJobNote(job, scored, c);
  assert.match(fs.readFileSync(file, 'utf8'), /status: applied/, 'a second write leaves the person\'s status alone');
});

test('the starter criteria leave the page-reading feeds off: Wellfound and Built In are opt-in', () => {
  const starter = JSON.parse(fs.readFileSync(path.join(ROOT, 'scraper', 'starter', 'criteria.json'), 'utf8'));
  assert.equal(starter.openSources.wellfound, false);
  assert.equal(starter.openSources.builtin, false);
  assert.equal(starter.openSources.remoteok, true, 'the API-backed feeds stay on');
});
