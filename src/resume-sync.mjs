// Keep the resume note application drafts read in step with the resume the person actually maintains.
//
// Drafts are written from Profile/Resume.md. The person edits their resume somewhere else — a Google Doc, a
// portfolio page, a .docx — and nothing noticed when the two drifted. The first time it happened on a real
// vault, an application packet went on quoting "three of five evals in production" after that line had been
// removed from the resume, and would have contradicted the person's own portfolio if it had been sent.
//
// So a sync does two jobs. It rewrites the note from the source, and it reports what changed — including any
// application packet that still quotes a claim the resume no longer makes. The second is the point.
//
// No credentials, no API. A source is a URL anyone can read, or a local file:
//   - a Google Doc shared as "anyone with the link can view" (fetched through its markdown export)
//   - any public page, e.g. a portfolio's /resume
//   - a local .md, .txt, .docx or .pdf — including a Doc downloaded with File > Download
import fs from 'node:fs';
import path from 'node:path';
import { P, VAULT, CONFIG_FILE, HOME_DIR } from './config.mjs';
import { htmlToText } from './sources.mjs';
import { extractText } from './resume.mjs';

/** The canonical resume note. Generic on purpose: nothing about it should assume whose resume it is. */
export const RESUME_NOTE = 'Profile/Resume.md';
/** Where earlier versions of this project kept it. Read as a fallback, never written. */
export const LEGACY_RESUME_NOTES = ['Profile/Resume - Design Engineer (Staff).md', 'Profile/Resume - Master.md'];

const today = () => new Date().toISOString().slice(0, 10);

// ---------------- the remembered source ----------------

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return {}; }
}
export function rememberedSource() {
  return readConfig().resumeSource || '';
}
function rememberSource(source) {
  fs.mkdirSync(HOME_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...readConfig(), resumeSource: source }, null, 2));
}

// ---------------- fetching ----------------

/** A Google Docs editing URL, turned into its markdown export URL. Anything else returns null. */
export function docExportUrl(url) {
  const m = String(url).match(/docs\.google\.com\/document\/d\/([A-Za-z0-9_-]+)/);
  return m ? `https://docs.google.com/document/d/${m[1]}/export?format=md` : null;
}

async function readSource(source) {
  if (/^https?:\/\//i.test(source)) {
    const exportUrl = docExportUrl(source);
    const res = await fetch(exportUrl || source, {
      headers: { 'user-agent': 'TekJobs/1.0 (resume sync; a link the user gave)', accept: 'text/markdown,text/plain,text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(25000),
    });
    const body = await res.text();
    if (exportUrl && (res.status === 401 || res.status === 403 || /accounts\.google\.com/.test(res.url))) {
      throw Object.assign(new Error([
        'That Google Doc is private, so it cannot be read without signing in, and this command does not sign in.',
        'Any one of these works:',
        '  1. Share the Doc as "Anyone with the link can view", then sync again.',
        '  2. File > Download > Markdown (.md) or Word (.docx), then: tekjobs resume sync <that file>',
        '  3. Sync from a public page instead, e.g. your portfolio\'s /resume.',
      ].join('\n')), { status: 403 });
    }
    if (!res.ok) throw Object.assign(new Error(`Fetching ${source} returned HTTP ${res.status}.`), { status: 502 });
    const isHtml = /text\/html/i.test(res.headers.get('content-type') || '') || /^\s*<!doctype html|<html[\s>]/i.test(body);
    return { text: isHtml ? pageText(body) : body, kind: exportUrl ? 'google-doc' : isHtml ? 'web-page' : 'url' };
  }
  const file = path.resolve(source);
  if (!fs.existsSync(file)) throw Object.assign(new Error(`No such file: ${file}`), { status: 404 });
  return { text: await extractText(file), kind: 'file' };
}

/**
 * A resume page as text: the <main> element when there is one, without the site's navigation, and with
 * in-site links reduced to their text. A resume that carries the whole site menu reads as a resume that
 * changed every time the menu did.
 */
function pageText(html) {
  const main = html.match(/<main[\s>][\s\S]*<\/main>/i);
  const scoped = (main ? main[0] : html)
    .replace(/<\s*(nav|header|footer|aside|button|svg|noscript)[\s>][\s\S]*?<\/\s*\1\s*>/gi, '')
    .replace(/<a [^>]*href="(?!https?:|mailto:)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi, '$1');
  return htmlToText(scoped);
}

// ---------------- comparing ----------------

/** Resume lines with markdown and spacing stripped, so the same text in two formats compares equal. */
function lines(text = '') {
  return String(text)
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')   // frontmatter
    .split(/\r?\n/)
    .filter((l) => !/^\s*>/.test(l))                  // banners about the note, not the resume
    .map((l) => l
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')        // links
      .replace(/^\s*(?:[#>*+-]|\d+\.)+\s*/, '')         // headings, quotes, bullets
      .replace(/[*_`]/g, '')
      .replace(/\s+/g, ' ')
      .trim())
    .filter((l) => l.length > 2);
}
const key = (l) => l.toLowerCase().replace(/[^\p{L}\p{N}%]+/gu, ' ').trim();

const NUMBER_WORD = /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|thirty|fifty|hundred|thousand|million|dozen|half)$/i;
const FILLER = new Set(['of', 'across', 'the', 'a', 'an', 'and', 'or', 'to', 'in', 'on', 'for', 'with', 'than', 'plus', 'more']);
const YEAR_OR_DATE = /^(19|20)\d\d$|^\d{1,2}$/;

/**
 * The checkable claims in a line: each figure or number word with the word it counts. "three of five evals"
 * gives "three five" and "five evals"; "175 components", "fifteen scheduled". Numbers are what a packet quotes
 * and what a reader checks, and pairing each with its noun survives rewording around it — "fifteen scheduled
 * operational pipelines" and "fifteen scheduled pipelines" make the same claim. Dates are not claims.
 */
function claims(line) {
  const words = key(line).split(' ').filter((w) => w && !FILLER.has(w));
  const out = new Set();
  words.forEach((w, i) => {
    const isFigure = /^\d/.test(w) && !YEAR_OR_DATE.test(w);   // starts with a digit: "175", "500k", not "html5" or "css3"
    if ((isFigure || NUMBER_WORD.test(w)) && words[i + 1] && !YEAR_OR_DATE.test(words[i + 1])) out.add(`${w} ${words[i + 1]}`);
  });
  return [...out];
}

/** The same pairs, for a whole text, so presence can be checked without caring how the sentence was phrased. */
const claimSet = (text) => new Set(lines(text).flatMap(claims));

// A reworded claim is still the same claim: "fifteen scheduled pipelines" and "15 scheduled pipelines",
// "175 components" and "a 175-component design system", "twelve packages" and "12 npm packages".
// So claims are compared on a canonical number plus the stem of the noun, and a claim counts as kept when
// both appear anywhere in one line of the new resume, not only side by side.
const WORD_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20, thirty: 30, fifty: 50, hundred: 100, thousand: 1000, million: 1000000, dozen: 12 };
const canonNum = (w) => (w.toLowerCase() in WORD_NUM ? String(WORD_NUM[w.toLowerCase()]) : w.toLowerCase());
const stem = (w) => w.toLowerCase().replace(/ies$/, 'y').replace(/(?<=[a-z]{3})s$/, '').slice(0, 8);
const claimKey = (c) => { const [n, ...rest] = c.split(' '); return `${canonNum(n)} ${stem(rest.join(' '))}`; };
/** True when some line of `text` carries the claim's number and its noun, however the sentence is built. */
function stillClaimed(claim, text) {
  const [n, ...rest] = claim.split(' ');
  const num = canonNum(n), noun = stem(rest.join(' '));
  return lines(text).some((l) => {
    const words = key(l).split(' ').filter(Boolean);
    return words.some((w) => canonNum(w) === num) && words.some((w) => stem(w) === noun);
  });
}

function currentNoteText() {
  for (const rel of [RESUME_NOTE, ...LEGACY_RESUME_NOTES]) {
    const file = path.join(VAULT, rel);
    if (fs.existsSync(file)) return { rel, text: fs.readFileSync(file, 'utf8') };
  }
  return { rel: '', text: '' };
}

/**
 * Job notes whose Application section still quotes a claim the resume has stopped making. Checked against
 * the new resume as a whole, so a claim that was only reworded — the figure still there in another line —
 * does not raise a false alarm.
 */
function stalePackets(removedLines, newText) {
  const kept = claimSet(newText);
  const gone = [...new Set(removedLines.flatMap(claims))].filter((c) => !kept.has(c) && !stillClaimed(c, newText));
  if (!gone.length || !fs.existsSync(P.jobs)) return [];
  const hits = [];
  for (const f of fs.readdirSync(P.jobs).filter((x) => x.endsWith('.md'))) {
    const text = fs.readFileSync(path.join(P.jobs, f), 'utf8');
    const section = (text.match(/^## Application\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/m) || [, ''])[1];
    if (!section.trim()) continue;
    const inPacket = new Set(claims(section).map(claimKey));
    const quoted = gone.filter((c) => inPacket.has(claimKey(c)));
    if (quoted.length) hits.push({ note: f.replace(/\.md$/, ''), quotes: quoted });
  }
  return hits;
}

/** Exposed for tests: the comparison is the part of this module that must not cry wolf, and must not go quiet. */
export const _internals = { claims, claimKey, stillClaimed, lines, stalePackets };

// ---------------- the command ----------------

export async function syncResume({ source = '', dry = false } = {}) {
  const src = source || rememberedSource();
  if (!src) {
    throw Object.assign(new Error('No resume source yet. Pass one the first time: tekjobs resume sync <google-doc-url | page-url | file>'), { status: 400 });
  }

  const { text, kind } = await readSource(src);
  const body = String(text).replace(/\r\n/g, '\n').trim();
  if (body.length < 400) {
    throw Object.assign(new Error(`The resume from ${src} came back nearly empty (${body.length} characters), so nothing was written. If it is a web page, check it renders without JavaScript.`), { status: 422 });
  }

  const previous = currentNoteText();
  const before = lines(previous.text);
  const after = lines(body);
  const beforeKeys = new Set(before.map(key));
  const afterKeys = new Set(after.map(key));
  const removed = before.filter((l) => !afterKeys.has(key(l)));
  const added = after.filter((l) => !beforeKeys.has(key(l)));
  const stale = stalePackets(removed, body);

  const note = [
    '---',
    'type: resume',
    'status: current',
    `source: ${JSON.stringify(src)}`,
    `source_kind: ${kind}`,
    `synced: ${today()}`,
    '---',
    `> **Synced from the source above on ${today()} by \`tekjobs resume sync\`.** Application drafts read this note. Edit the source, not this note: the next sync replaces it.`,
    '',
    body,
    '',
  ].join('\n');

  if (!dry) {
    fs.mkdirSync(path.join(VAULT, 'Profile'), { recursive: true });
    fs.writeFileSync(path.join(VAULT, RESUME_NOTE), note);
    if (source) rememberSource(/^https?:\/\//i.test(source) ? source : path.resolve(source));
  }

  return { source: src, kind, chars: body.length, previous: previous.rel, removed, added, stale, wrote: !dry, note: RESUME_NOTE };
}
