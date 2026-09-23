// Cover letters, written from the posting and the person's own resume.
//
// Two ways in, one set of rules:
//   - The app's button runs a local LLM CLI the person is already signed in to (Claude Code by default, Codex
//     or anything else that reads a prompt on stdin). No API key; it rides their subscription.
//   - An agent connected over MCP asks for the same materials, writes the letter itself, and saves it.
// Either way the letter is checked against the resume before it is kept: a figure the resume does not make is
// flagged, because a cover letter is exactly where an eager model invents one.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import * as store from './store.mjs';
import { CONFIG_FILE, VAULT } from '../../scraper/config.mjs';
import { _internals as resumeCheck } from '../../scraper/resume-sync.mjs';

const EMPHASES = {
  auto: 'Choose whichever of the two emphases below the posting itself asks for, and commit to it.',
  'design-systems': 'Lead with design systems: component architecture, tokens, accessibility gates, adoption across teams.',
  'ai-product': 'Lead with AI product surfaces: making model behaviour legible and controllable, retrieval, evaluation, agent tooling.',
};
const LENGTHS = { short: [110, 170], standard: [170, 250] };

// The hard constraints. Voice and shape come from the person's own Profile/Voice.md when it exists (it is
// written into the prompt verbatim), with DEFAULT_VOICE as the fallback for a profile that has none yet.
const RULES = `Hard rules, all binding:
- Every fact about the candidate comes from the RESUME or PROFILE below. Do not invent employers, dates, numbers, outcomes, team sizes or technologies. A figure the resume gives may be used exactly; never rounded, never a new one.
- Name the company in the first two sentences and write about their specific product, by name, not the category it belongs to ("Linear's site", never "a developer tool's website"). A letter that never says the company's name is a form letter and will be rejected by the checker.
- No placeholders in brackets. With no name to address, open with "Hello,".
- Close with the portfolio link once, exactly as the PROFILE gives it, the availability exactly as the profile states it, and the name. No sign-off word, no address block, no subject line.
- Plain text only. No markdown, no bullets, no headings, no bold. Short paragraphs separated by blank lines.
- No em dashes or en dashes anywhere.
- Output the finished letter and nothing else: no preamble, no notes, no title.`;

const DEFAULT_VOICE = `Voice and shape:
- First person singular, written to a peer. Short plain sentences, one idea each, varied in length.
- No adjectives about yourself. No "passionate", "excited", "thrilled", "strong", "deep", "leverage", "robust", "delve", "elevate", "empower".
- Start inside their problem, in your own words: one or two sentences showing you understood what they are building and why the hard part is hard. Not a quote, not "I am writing to apply", not "for more than a decade".
- One piece of evidence with enough detail to be believed. A second only if it is a different kind of thing. Answer what they ask for without announcing that you are answering ("You ask for X" is banned).
- Quote the posting at most once. No "not X but Y" contrasts, no colon reveals, no rhetorical questions, no closing metaphor. End on the last concrete fact.`;

const EDIT_PASS = `Process: write a draft, then edit it as a sharp human editor before you output it. In the edit, cut every sentence that could move unchanged into a letter to a different company (the portability test); break any pattern where two paragraphs open the same way or three sentences share a shape; remove every adjective the candidate applies to himself; remove any sentence that only explains the sentence before it; check every number against the RESUME; count the quotations from the posting and keep at most one. Output only the edited letter.`;

/**
 * The posting text to write from. The note's copy is a scan-time snapshot and is sometimes a stub: a few
 * boards nest their HTML in ways the scanner flattens to one paragraph. A letter written from a stub is
 * generic by construction, so when the copy is thin the live posting is fetched. The note is not rewritten.
 */
const THIN = 1500;
const livePostings = new Map();
async function postingText(job) {
  const noted = job.sections.description.replace(/^>.*$/gm, '').trim();
  if (noted.length >= THIN || !job.url) return { text: noted, source: 'note' };
  if (!livePostings.has(job.id)) {
    try { const r = await store.fetchLink(job.url, { maxChars: 12000 }); livePostings.set(job.id, r.status < 400 ? r.text : ''); }
    catch { livePostings.set(job.id, ''); }
  }
  const live = livePostings.get(job.id);
  return live.length > noted.length ? { text: live, source: 'live posting' } : { text: noted, source: 'note (thin, and the live posting could not be read)' };
}

/** Everything a writer needs, as one prompt. The same text goes to the CLI and to an MCP agent. */
export async function materials(id, { emphasis = 'auto', length = 'standard', extra = '' } = {}) {
  const job = store.getJob(id);
  const posting = await postingText(job);
  const packet = store.applicationPacket(id);
  const { profile, positioning, resume } = store.profile();
  if (!resume.trim()) throw Object.assign(new Error('No resume in the profile yet. Import one first (tekjobs resume <file>).'), { status: 409 });
  const [lo, hi] = LENGTHS[length] || LENGTHS.standard;
  const packetBits = ['Narrative', 'Tailored summary', 'Tailored bullets', 'Portfolio', 'Risks', 'Contact / referral']
    .filter((f) => packet.values[f]).map((f) => `${f}: ${packet.values[f]}`).join('\n');
  const voice = readVoice();
  const prompt = [
    `Write a cover letter for this job application, ${lo} to ${hi} words, in the candidate's own voice.`,
    `Emphasis: ${EMPHASES[emphasis] || EMPHASES.auto}`,
    extra.trim() ? `The candidate also asked: ${extra.trim()}` : '',
    RULES,
    voice ? `=== THE CANDIDATE'S OWN WRITING RULES AND VOICE (binding; match the register of the samples, never copy their sentences) ===\n${voice}` : DEFAULT_VOICE,
    EDIT_PASS,
    `=== POSTING ===\nCompany: ${job.company}\nTitle: ${job.title}\nLocation: ${job.location}\n\n${posting.text.slice(0, 9000)}`,
    `=== WHY THE SCANNER MATCHED IT ===\n${job.sections.why}`,
    packetBits ? `=== WHAT HAS ALREADY BEEN DECIDED FOR THIS APPLICATION ===\n${packetBits}` : '',
    `=== RESUME (the only source of facts) ===\n${strip(resume)}`,
    `=== PROFILE ===\n${strip(profile).slice(0, 3500)}`,
    positioning.trim() ? `=== POSITIONING ===\n${strip(positioning).slice(0, 2500)}` : '',
  ].filter(Boolean).join('\n\n');
  return { id, company: job.company, title: job.title, emphasis, length, words: [lo, hi], postingSource: posting.source, postingChars: posting.text.length, prompt, rules: RULES };
}
const strip = (md) => md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').replace(/^>.*$/gm, '').trim();
/** Profile/Voice.md: how this person writes, in their own words, with samples. Optional; the fallback is generic. */
export function readVoice() {
  try { return fs.readFileSync(path.join(VAULT, 'Profile', 'Voice.md'), 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').replace(/^> (\*\*)?The cover-letter writer reads this note.*\n/m, '').trim(); }
  catch { return ''; }
}

/**
 * The figures a letter asserts, each with the word it counts.
 *
 * Stricter than the resume differ's extractor on purpose. That one ignores one and two digit numbers, because
 * in a resume they are mostly days of the month. In a letter they are mostly the invented ones: "a team of 40",
 * "8 years", "3x faster". Here only a number beside a month name, or a four digit year, is treated as a date.
 * "one" is left out: in prose it is a pronoun far more often than a count ("one I have worked on").
 */
const MONTH = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)$/;
const COUNT_WORD = /^(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|thirty|forty|fifty|hundred|thousand|million|dozen)$/;
const SKIP = new Set(['of', 'across', 'the', 'a', 'an', 'and', 'or', 'to', 'in', 'on', 'for', 'with', 'than', 'plus', 'more', 'over', 'about', 'around', 'nearly', 'up']);
const NOT_A_NOUN = new Set(['i', 'we', 'you', 'it', 'is', 'was', 'are', 'that', 'this', 'have', 'has', 'had', 'will', 'would', 'can', 'at', 'by', 'from', 'as', 'so', 'but', 'if', 'when', 'my', 'your', 'their', 'our']);
/** "29,000" is one number. Left alone, the comma splits it into "29" and "000" and neither means anything. */
const ungroup = (s) => String(s).replace(/(\d),(?=\d{3}\b)/g, '$1');
export function letterClaims(text) {
  const out = new Set();
  for (const line of resumeCheck.lines(ungroup(text))) {
    const words = line.toLowerCase().replace(/[^\p{L}\p{N}%]+/gu, ' ').trim().split(' ').filter((w) => w && !SKIP.has(w));
    words.forEach((w, i) => {
      const figure = /^\d/.test(w) && !/^(19|20)\d\d$/.test(w);
      if (!figure && !COUNT_WORD.test(w)) return;
      const prev = words[i - 1] || '', next = words[i + 1] || '';
      if (figure && (MONTH.test(prev) || MONTH.test(next))) return;          // "November 3", "3 November"
      if (!next || NOT_A_NOUN.has(next) || /^(19|20)\d\d$/.test(next)) return;
      out.add(`${w} ${next}`);
    });
  }
  return [...out];
}

/**
 * The patterns that make a letter read as generated. Each is a regex and the sentence a person would say about
 * it. Drawn from the no-ai-slop editing rules and from the first letter the button produced, which opened with
 * a decade, quoted the posting three times, and answered it in three identical "You ask for" stanzas.
 */
const SLOP = [
  [/\b(for |over )?more than a decade\b|\bover a decade\b|\ba decade of\b/i, 'opens on "a decade": the sentence every applicant with ten years writes'],
  [/\bthat is (exactly )?the (line|seam|problem|gap|work|job|role) (i|you)\b/i, 'a tag line explaining the sentence before it ("That is the line I have worked on")'],
  [/\b(not just|not only|isn't just|is not just) \w[^.]{0,60}?\b(but|it's|it is)\b/i, 'a "not just X but Y" contrast; say Y'],
  [/\b(isn't|is not|wasn't) (about|a matter of) [^.]{2,50}\. (it's|it is) /i, 'an "it isn\'t X, it\'s Y" contrast; say Y'],
  [/^[^:\n]{3,60}: [a-z][^.\n]{4,}\.?$/m, 'a colon reveal ("The result: a system that lasts")'],
  [/\b(i believe|i am confident|i would love|i look forward|thank you for (your|the) consideration|i am writing to)\b/i, 'applicant boilerplate ("I believe", "I look forward", "I am writing to")'],
  [/\b(leverage|leveraging|robust|delve|elevate|empower|passionate|excited|thrilled|synergy|cutting-edge|ever-evolving|multifaceted|meticulous|transformative)\b/i, 'a word from the banned list'],
  [/\b(uncompromising|relentless|meticulous|obsessive|deep (design )?sensibility|strong (visual |design )?(taste|eye|sense)|craft bar)\b/i, 'an adjective about yourself; let the facts carry it'],
  [/\?(\s|$)/, 'a rhetorical question'],
];
export function slopFindings(text) {
  const out = [];
  for (const [re, why] of SLOP) { const m = text.match(re); if (m) out.push(`${why}: "${m[0].trim().slice(0, 60)}"`); }
  const youAsk = (text.match(/\byou (ask|are looking|are asking|want|need|describe)\b/gi) || []).length;
  if (youAsk >= 2) out.push(`answers the posting in ${youAsk} "You ask for" stanzas; a form, not a letter`);
  const quotes = (text.match(/"[^"\n]{6,}"/g) || []).length;
  if (quotes > 1) out.push(`quotes the posting ${quotes} times; once at most`);
  const paras = text.split(/\n\s*\n/).map((p) => p.trim().split(/\s+/).slice(0, 2).join(' ').toLowerCase()).filter(Boolean);
  const dupOpen = paras.find((p, i) => p.length > 3 && paras.indexOf(p) !== i);
  if (dupOpen) out.push(`two paragraphs open the same way ("${dupOpen}…")`);
  return out;
}

/** Deterministic checks on a finished letter. Warnings, never blocks: the person decides. */
export function check(id, text) {
  const job = store.getJob(id);
  const { resume, profile } = store.profile();
  // The live posting counts as a source too, when one was fetched: quoting their own number back is not inventing it.
  const sources = `${resume}\n${profile}\n${job.sections.description}\n${livePostings.get(job.id) || ''}\n${job.company} ${job.title}`;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const warnings = [];
  const unsupported = letterClaims(text).filter((c) => !resumeCheck.stillClaimed(c, ungroup(sources)));
  for (const c of unsupported) warnings.push({ kind: 'claim', text: `"${c}" is not on your resume, your profile or the posting. Check it before sending.` });
  if (/[—–]/.test(text)) warnings.push({ kind: 'style', text: 'Contains an em or en dash. Your own rule is none in anything you send.' });
  const ph = text.match(/\[[^\]\n]{2,40}\]/g); if (ph) warnings.push({ kind: 'placeholder', text: `Placeholder left in: ${[...new Set(ph)].join(', ')}` });
  const cliche = ['great fit', 'perfect fit', 'dear hiring manager', 'to whom it may concern', 'fast-paced', 'team player', 'hit the ground running'].filter((p) => text.toLowerCase().includes(p));
  if (cliche.length) warnings.push({ kind: 'style', text: `Stock phrases: ${cliche.join(', ')}.` });
  for (const s of slopFindings(text)) warnings.push({ kind: 'slop', text: s });
  if (!text.toLowerCase().includes(job.company.toLowerCase().split(/[ (]/)[0])) warnings.push({ kind: 'specific', text: `Never names ${job.company}. A letter that could go to anyone reads like one.` });
  if (words > 290) warnings.push({ kind: 'length', text: `${words} words. Most readers stop near 250.` });
  if (words && words < 90) warnings.push({ kind: 'length', text: `${words} words. Probably too thin to carry proof.` });
  return { words, warnings };
}

export function saved(id) {
  const text = store.getCoverLetter(id);
  return text ? { text, ...check(id, text) } : null;
}
export function save(id, text, via = 'app') {
  const clean = String(text || '').replace(/\r/g, '').trim();
  if (clean.length < 80) throw Object.assign(new Error('That is too short to be a cover letter.'), { status: 400 });
  store.saveCoverLetter(id, clean, via);
  return saved(id);
}

// ---------------- the local runner ----------------

/** Which CLI writes the letter. ~/.tekjobs/config.json: { "llm": { "command": "claude", "args": ["-p"] } } */
export function runnerConfig() {
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')).llm || {}; } catch { /* none */ }
  if (process.env.TEKJOBS_LLM_CMD) cfg = { command: process.env.TEKJOBS_LLM_CMD, args: (process.env.TEKJOBS_LLM_ARGS || '').split(' ').filter(Boolean) };
  return { command: cfg.command || 'claude', args: cfg.args || ['-p', '--output-format', 'text'] };
}

/**
 * @param {string} prompt          written to the CLI's stdin
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs]
 * @param {string[]} [opts.extraArgs]  appended after the configured args: the mail check passes tool allow and
 *                                      deny lists here so a run can read a mailbox and nothing else
 */
export function runLLM(prompt, { timeoutMs = 240000, extraArgs = [] } = {}) {
  const { command, args } = runnerConfig();
  // An empty working directory, so the CLI does not load some project's hooks, MCP servers or instructions.
  const cwd = path.join(os.tmpdir(), 'tekjobs-llm'); fs.mkdirSync(cwd, { recursive: true });
  return new Promise((resolve, reject) => {
    let out = '', err = '';
    const child = spawn(command, [...args, ...extraArgs], { cwd, shell: true, env: process.env });   // shell: npm-installed CLIs are .cmd shims on Windows
    const timer = setTimeout(() => { child.kill(); reject(new Error(`${command} did not answer within ${Math.round(timeoutMs / 1000)} seconds.`)); }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(new Error(`Could not start "${command}": ${e.message}`)); });
    child.on('close', (code) => {
      clearTimeout(timer);
      const all = `${out}\n${err}`;
      if (/not recognized as|command not found|ENOENT/i.test(all)) return reject(Object.assign(new Error(`"${command}" is not installed or not on PATH. Install Claude Code, or set another CLI under "llm" in ${CONFIG_FILE}.`), { kind: 'missing' }));
      if (/failed to authenticate|oauth|not logged in|please log in|login required|unauthorized|401/i.test(all)) return reject(Object.assign(new Error(`${command} is signed out. Open a terminal, run "${command}", sign in, then try again. (The desktop app's login is separate from the terminal's.)`), { kind: 'auth' }));
      if (/requires a newer version|please upgrade/i.test(all)) return reject(Object.assign(new Error(`${command} is out of date and its model refused the request. Update it (npm i -g, or its own updater), then try again.`), { kind: 'outdated' }));
      if (code !== 0 && !out.trim()) return reject(new Error(`${command} exited with code ${code}: ${err.trim().split('\n').slice(-2).join(' ') || 'no output'}`));
      resolve(out.replace(/^```[a-z]*\n|\n```\s*$/g, '').trim());
    });
    child.stdin.write(prompt); child.stdin.end();
  });
}

const drafts = new Map();   // id → { running, startedAt, finishedAt, error, errorKind }
export function state(id) {
  const d = drafts.get(id) || { running: false, startedAt: null, finishedAt: null, error: '', errorKind: '' };
  return { ...d, saved: saved(id), runner: runnerConfig().command };
}
export function start(id, opts = {}) {
  const cur = drafts.get(id);
  if (cur?.running) return state(id);
  store.getJob(id);   // throws early, and synchronously, if there is no such job
  drafts.set(id, { running: true, startedAt: new Date().toISOString(), finishedAt: null, error: '', errorKind: '' });
  materials(id, opts).then((m) => runLLM(m.prompt))
    .then((text) => { save(id, text, `app · ${runnerConfig().command}`); drafts.set(id, { ...drafts.get(id), running: false, finishedAt: new Date().toISOString() }); })
    .catch((e) => drafts.set(id, { ...drafts.get(id), running: false, finishedAt: new Date().toISOString(), error: e.message, errorKind: e.kind || 'failed' }));
  return state(id);
}
export { VAULT };
