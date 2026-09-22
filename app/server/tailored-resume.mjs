// A resume tailored to one posting, and the proof that it is still the same resume.
//
// The letter is prose and may say new sentences. The resume is a record and may not. Tailoring here means:
// rewrite the summary for this posting, reorder and prune bullets, promote the products and skills the posting
// cares about, tighten wording. It never adds a bullet, a title, an employer, a date or a number. The checker
// enforces that mechanically: every bullet must trace to a line of the real resume, every figure must already
// be there, every employer and date line must survive unchanged.
import fs from 'node:fs';
import * as store from './store.mjs';
import { runLLM, runnerConfig, readVoice, letterClaims } from './cover-letter.mjs';
import { _internals as resumeCheck } from '../../src/resume-sync.mjs';

const EMPHASES = {
  auto: 'Choose whichever emphasis the posting itself asks for, and commit to it.',
  'design-systems': 'Lead with design systems: component architecture, tokens, accessibility gates, adoption across teams.',
  'ai-product': 'Lead with AI product surfaces: retrieval, evaluation, agent tooling, making model behaviour legible.',
};

const RULES = `Hard rules, all binding. This is a factual document that the candidate will upload; a false line here is a lie on an application.
- Keep every employer, job title, location and date range exactly as the RESUME states them. Do not add, remove, merge or reorder jobs. Do not change a single number.
- Every bullet you write must be a rewording, tightening or straight copy of a bullet that exists in the RESUME for that same job. You may drop bullets, reorder them within a job, merge two into one, and cut words. You may not introduce a new claim, tool, outcome or responsibility. When in doubt, copy the original bullet.
- The summary is the one part you write fresh, for this posting: two or three sentences describing the candidate in the terms this posting cares about. It describes the candidate, never the company or the team ("The Magic Team needs..." is wrong; "Design engineer who builds..." is right). No "I". No "more than a decade" opener. Facts only from the RESUME.
- Reorder the Capabilities lines and the Selected independent products to put what this posting cares about first. Do not add capabilities the RESUME does not list.
- No adjectives about the candidate ("strong", "passionate", "proven"). No em dashes or en dashes.
- Output Markdown in exactly this structure and nothing else:

# {Name}
**{Title line}**
{Location} | {phone} | {email} | {links, exactly as the RESUME's header gives them}

## Summary
{paragraph}

## Experience
### {Company} | {Title}
{Dates} | {Location}
- {bullet}

(one ### block per job, all jobs, in the RESUME's order)

## Capabilities
- **{Group}:** {items}

## Selected independent products
### {Product} | {one-line descriptor}
- {bullet}

## Earlier experience
{the RESUME's earlier-experience lines, unchanged}

## Education
{unchanged}`;

export async function materials(id, { emphasis = 'auto', extra = '' } = {}) {
  const job = store.getJob(id);
  const packet = store.applicationPacket(id);
  const { resume, profile } = store.profile();
  if (!resume.trim()) throw Object.assign(new Error('No resume in the profile yet. Import one first (tekjobs resume <file>).'), { status: 409 });
  const posting = job.sections.description.replace(/^>.*$/gm, '').trim();
  const decided = ['Narrative', 'Tailored summary', 'Tailored bullets', 'Portfolio', 'Risks'].filter((f) => packet.values[f]).map((f) => `${f}: ${packet.values[f]}`).join('\n');
  const voice = readVoice();
  const prompt = [
    `Tailor the candidate's resume to this posting. Same facts, same jobs, same dates, same numbers; different emphasis, order and summary.`,
    `Emphasis: ${EMPHASES[emphasis] || EMPHASES.auto}`,
    extra.trim() ? `The candidate also asked: ${extra.trim()}` : '',
    RULES,
    voice ? `=== HOW THE CANDIDATE WRITES (for the summary's register) ===\n${voice.split('## What a good letter')[0].trim()}` : '',
    `=== POSTING ===\nCompany: ${job.company}\nTitle: ${job.title}\nLocation: ${job.location}\n\n${posting.slice(0, 8000)}`,
    decided ? `=== WHAT HAS ALREADY BEEN DECIDED FOR THIS APPLICATION ===\n${decided}` : '',
    `=== RESUME (the only source of facts; page markers like "Page 1" and "-- 1 of 2 --" are artifacts, drop them) ===\n${strip(resume)}`,
    `=== PROFILE (context only; facts still come from the RESUME) ===\n${strip(profile).slice(0, 2500)}`,
  ].filter(Boolean).join('\n\n');
  return { id, company: job.company, title: job.title, emphasis, prompt, rules: RULES };
}
const strip = (md) => md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').replace(/^>.*$/gm, '').trim();

// ---------------- the check ----------------

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'with', 'at', 'by', 'from', 'as', 'that', 'this', 'it', 'its', 'is', 'are', 'was', 'were', 'be', 'i', 'my', 'we', 'our', 'their', 'into', 'across', 'than', 'plus', 'also', 'then', 'so', 'own', 'built', 'build', 'led', 'lead', 'work', 'worked', 'team', 'teams', 'product', 'products']);
const words = (s) => new Set(s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter((w) => w.length > 2 && !STOP.has(w)));
/** How much of the bullet's substance appears in one source line: the share of its content words found there. */
function bestTrace(bullet, sourceLines) {
  const b = words(bullet);
  if (b.size === 0) return { score: 1, line: '' };
  let best = { score: 0, line: '' };
  for (const line of sourceLines) {
    const l = words(line);
    let hit = 0; for (const w of b) if (l.has(w)) hit++;
    const score = hit / b.size;
    if (score > best.score) best = { score, line };
  }
  return best;
}
const TRACE_MIN = 0.6;

/** Every bullet traces to the resume, every figure is already there, every job header is intact. */
export function check(id, markdown) {
  return checkAgainst(markdown, store.profile().resume);
}
export function checkAgainst(markdown, resumeText) {
  const src = strip(resumeText);
  const srcLines = resumeCheck.lines(src);
  const warnings = [];
  const out = String(markdown || '');
  // Bullets: traceability.
  const bullets = out.split(/\r?\n/).filter((l) => /^\s*-\s+/.test(l) && !/^\s*-\s+\*\*/.test(l)).map((l) => l.replace(/^\s*-\s+/, '').trim());
  for (const b of bullets) {
    const t = bestTrace(b, srcLines);
    if (t.score < TRACE_MIN) warnings.push({ kind: 'trace', text: `Not on your resume (${Math.round(t.score * 100)}% overlap with the closest line): "${b.slice(0, 90)}"` });
  }
  // Figures: none new.
  for (const c of letterClaims(out).filter((c) => !resumeCheck.stillClaimed(c, src))) warnings.push({ kind: 'claim', text: `"${c}" is not a figure your resume gives.` });
  // Jobs: every "Company | Title" header from the source must appear, and no header may be new.
  const srcHeads = srcLines.filter((l) => /\|/.test(l) && !/@|\d{3}\.\d{3}/.test(l) && !/^(design|engineering|ai and automation|platform)\b/i.test(l)).map((l) => l.split('|')[0].trim().toLowerCase()).filter((h) => h.length > 2);
  const outHeads = [...out.matchAll(/^###\s+(.+?)\s*\|/gm)].map((m) => m[1].trim().toLowerCase());
  for (const h of outHeads) if (!srcHeads.some((s) => s.startsWith(h) || h.startsWith(s))) warnings.push({ kind: 'header', text: `"${h}" is not a job or product on your resume.` });
  // Dates: every date range in the output must exist in the source.
  const dateRe = /\b(January|February|March|April|May|June|July|August|September|October|November|December|[A-Z][a-z]{2})\s+\d{4}\s*(?:-|–|to)\s*(?:Present|[A-Z][a-z]+\s+\d{4})/g;
  const srcDates = new Set((src.match(dateRe) || []).map((d) => d.replace(/\s+/g, ' ')));
  for (const d of new Set((out.match(dateRe) || []).map((d) => d.replace(/\s+/g, ' ')))) if (!srcDates.has(d)) warnings.push({ kind: 'date', text: `Date range "${d}" is not on your resume.` });
  if (/[—–]/.test(out)) warnings.push({ kind: 'style', text: 'Contains an em or en dash.' });
  const w = out.trim().split(/\s+/).length;
  if (w > 900) warnings.push({ kind: 'length', text: `${w} words; the source resume is about ${src.split(/\s+/).length}. This will not fit two pages.` });
  return { words: w, bullets: bullets.length, warnings };
}

// ---------------- storage ----------------

// A note section ends at the next "## " line, and a resume is full of them. So the resume is stored with every
// heading demoted two levels (its "## Experience" becomes "#### Experience"), which keeps it nested under the
// note's own "## Tailored resume" heading, reads correctly in Obsidian, and comes back intact.
export const demote = (md) => md.replace(/^(#{1,4}) /gm, '$1## ');
export const promote = (md) => md.replace(/^#{2}(#{1,4}) /gm, '$1 ');

export function saved(id) {
  const stored = store.getSection(id, 'Tailored resume');
  if (!stored) return null;
  const text = promote(stored);
  return { text, ...check(id, text) };
}
export function save(id, markdown, via = 'app') {
  const clean = String(markdown || '').replace(/\r/g, '').replace(/^```(?:markdown|md)?\n|\n```\s*$/g, '').trim();
  if (!/^#\s+\S/m.test(clean) || !/^## Experience/m.test(clean)) throw Object.assign(new Error('That does not look like a resume in the expected structure (needs a "# Name" heading and "## Experience").'), { status: 400 });
  store.saveSection(id, 'Tailored resume', demote(clean), `Tailored ${store.isoDay()} (via ${via}). Same facts as the resume of record, reordered and re-summarised for this posting. Headings are nested under this one; the app and the print view restore them. Check the warnings, then print it.`);
  store.saveApplicationDraft(id, { field: 'Resume variant', value: `Tailored for this posting ${store.isoDay()}; full text under "Tailored resume" in this note; print view at /api/jobs/${encodeURIComponent(id)}/resume.html` });
  return saved(id);
}

// ---------------- the run ----------------

const runs = new Map();
export function state(id) {
  const d = runs.get(id) || { running: false, startedAt: null, finishedAt: null, error: '', errorKind: '' };
  return { ...d, saved: saved(id), runner: runnerConfig().command };
}
export function start(id, opts = {}) {
  if (runs.get(id)?.running) return state(id);
  store.getJob(id);
  runs.set(id, { running: true, startedAt: new Date().toISOString(), finishedAt: null, error: '', errorKind: '' });
  materials(id, opts).then((m) => runLLM(m.prompt, { timeoutMs: 300000 }))
    .then((text) => { save(id, text, `app · ${runnerConfig().command}`); runs.set(id, { ...runs.get(id), running: false, finishedAt: new Date().toISOString() }); })
    .catch((e) => runs.set(id, { ...runs.get(id), running: false, finishedAt: new Date().toISOString(), error: e.message, errorKind: e.kind || 'failed' }));
  return state(id);
}

// ---------------- print view ----------------

/** A self-contained page for "Print… → Save as PDF". Deliberately plain: one column, system-safe type, real margins. */
export function html(id) {
  const stored = store.getSection(id, 'Tailored resume');
  if (!stored) throw Object.assign(new Error('No tailored resume for this job yet.'), { status: 404 });
  const md = promote(stored);
  const job = store.getJob(id);
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
  const lines = md.split(/\r?\n/);
  let out = ''; let inList = false; let i = 0;
  const closeList = () => { if (inList) { out += '</ul>'; inList = false; } };
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*-\s+/.test(l)) { if (!inList) { out += '<ul>'; inList = true; } out += `<li>${inline(l.replace(/^\s*-\s+/, ''))}</li>`; i++; continue; }
    closeList();
    if (/^# /.test(l)) out += `<h1>${inline(l.slice(2))}</h1>`;
    else if (/^## /.test(l)) out += `<h2>${inline(l.slice(3))}</h2>`;
    else if (/^### /.test(l)) { const [role, ...rest] = l.slice(4).split('|'); out += `<h3><span>${inline(role.trim())}</span>${rest.length ? `<span class="t">${inline(rest.join('|').trim())}</span>` : ''}</h3>`; }
    else if (l.trim()) out += `<p class="${i === 1 || /^\*\*.*\*\*$/.test(l.trim()) ? 'title' : ''}">${inline(l)}</p>`;
    i++;
  }
  closeList();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(job.company)} · resume</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  @page { size: Letter; margin: 0.6in 0.7in; }
  html { font-size: 10.5pt; }
  body { max-width: 7.6in; margin: 0 auto; padding: 24px; font-family: Inter, "Helvetica Neue", Arial, system-ui, sans-serif; color: #1a1a1a; line-height: 1.38; }
  h1 { font-size: 20pt; margin: 0 0 2px; letter-spacing: -0.01em; }
  .title { margin: 0 0 2px; font-weight: 600; }
  h1 + .title + p, h1 + p { color: #444; margin: 0 0 14px; font-size: 9.5pt; }
  h2 { font-size: 9pt; letter-spacing: 0.12em; text-transform: uppercase; color: #555; margin: 16px 0 6px; padding-bottom: 3px; border-bottom: 1px solid #ccc; }
  h3 { display: flex; justify-content: space-between; gap: 12px; font-size: 10.5pt; margin: 10px 0 0; }
  h3 .t { font-weight: 500; color: #333; }
  h3 + p { margin: 0 0 4px; color: #555; font-size: 9.5pt; }
  p { margin: 0 0 6px; }
  ul { margin: 2px 0 6px; padding-left: 16px; }
  li { margin: 0 0 2px; }
  .bar { position: sticky; top: 0; display: flex; gap: 12px; align-items: center; justify-content: space-between; margin: -24px -24px 20px; padding: 10px 24px; background: #f3f8f6; border-bottom: 1px solid #dadfdd; font-size: 12px; }
  .bar button { font: inherit; padding: 6px 12px; border: 1px solid #0f6e56; border-radius: 6px; background: #0f6e56; color: #fff; cursor: pointer; }
  @media print { .bar { display: none; } body { padding: 0; } }
</style></head><body>
<div class="bar"><span>Tailored for <strong>${esc(job.company)}</strong>, ${esc(job.title)}. Print and choose "Save as PDF"; margins and page size are set.</span><button onclick="window.print()">Print / Save as PDF</button></div>
${out}
</body></html>`;
}
