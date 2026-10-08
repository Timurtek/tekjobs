// The daily journal: what happened in the search on one day, read from the record itself and written as the last
// section of that day's log note. Runs (from the log's own run sections), what was found, every decision made
// (status moves, with who made them), mail confirmed or dismissed, and notes added. Nothing is stored twice: the
// section is rebuilt from the notes each time and replaces the previous one, so a day's journal is always the
// day's whole story. The site promises that the notes are the record; this is the record read back as a day.
import fs from 'node:fs';
import path from 'node:path';
import { P, DATA_DIR, localDay } from './config.mjs';

export const JOURNAL_HEADING = '## Journal';
const isoDay = (d = new Date()) => localDay(d);

const readFm = (text) => {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const out = {};
  if (m) for (const line of m[1].split(/\r?\n/)) { const i = line.indexOf(':'); if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"(.*)"$/, '$1'); }
  return out;
};

/** The day's events, as data. `date` is YYYY-MM-DD; today by default. */
export function buildJournal(date = isoDay()) {
  const found = [], moves = [], notes = [];
  if (fs.existsSync(P.jobs)) {
    for (const f of fs.readdirSync(P.jobs).filter((x) => x.endsWith('.md'))) {
      let text; try { text = fs.readFileSync(path.join(P.jobs, f), 'utf8'); } catch { continue; }
      const fm = readFm(text);
      const id = f.replace(/\.md$/, '');
      const row = { id, company: fm.company || '', title: fm.title || '', score: Number(fm.score) || 0, status: fm.status || 'new' };
      if (fm.found === date) found.push(row);
      for (const m of text.matchAll(/^- (\d{4}-\d{2}-\d{2}) — (.*?) → \*\*([a-z]+)\*\*(?: \(([^)]*)\))? \(via ([^)]+)\)/gm)) {
        if (m[1] === date) moves.push({ ...row, from: m[2], to: m[3], reason: m[4] || '', via: m[5] });
      }
      for (const m of text.matchAll(/^- (\d{4}-\d{2}-\d{2}) \(([^)]+)\): (.+)$/gm)) {
        if (m[1] === date) notes.push({ ...row, via: m[2], text: m[3].slice(0, 160) });
      }
    }
  }
  // Mail: items confirmed or dismissed on the day, from the check's own state.
  let mail = { confirmed: 0, dismissed: 0, items: [] };
  try {
    const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'mail-check.json'), 'utf8'));
    for (const i of d.items || []) {
      const at = i.resolved?.at ? String(i.resolved.at).slice(0, 10) : '';
      if (at !== date) continue;
      if (i.state === 'confirmed') mail.confirmed++; else if (i.state === 'dismissed') mail.dismissed++;
      mail.items.push({ company: i.company || '', role: i.role || '', kind: i.kind || '', state: i.state, status: i.resolved?.status || '' });
    }
  } catch { /* no mail state */ }
  // Runs: the log's own "## Run" sections for the day.
  const runs = [];
  const logFile = path.join(P.logs, `${date}.md`);
  if (fs.existsSync(logFile)) {
    const text = fs.readFileSync(logFile, 'utf8');
    for (const m of text.matchAll(/^## Run (.+?)\n([\s\S]*?)(?=^## |(?![\s\S]))/gm)) {
      const b = m[2];
      const g = (re) => (b.match(re) || [])[1];
      runs.push({ when: m[1].trim(), boardsOk: Number(g(/Boards: (\d+)\//)) || 0, boardsTotal: Number(g(/Boards: \d+\/(\d+)/)) || 0, scanned: Number((g(/postings scanned: ([\d,]+)/) || '0').replace(/,/g, '')), newNotes: Number(g(/\*\*new: (\d+)\*\*/)) || 0, closed: Number(g(/closed: (\d+)/)) || 0, dry: /\(dry\)/.test(m[1]) });
    }
  }
  const byTo = {};
  for (const m of moves) (byTo[m.to] ||= []).push(m);
  return { date, runs, found, moves, byTo, notes, mail, empty: runs.length === 0 && found.length === 0 && moves.length === 0 && notes.length === 0 && mail.items.length === 0 };
}

const line = (r) => `${r.company} — ${r.title}`;
const plural = (n, s, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;

/** The journal as the markdown section the log note carries. */
export function renderJournal(j) {
  const out = [JOURNAL_HEADING, ''];
  if (j.empty) { out.push('Nothing happened in the search today: no run, no decisions, no mail.', ''); return out.join('\n'); }
  const real = j.runs.filter((r) => !r.dry);
  if (real.length) {
    const last = real[real.length - 1];
    out.push(`- **Scan**: ${plural(real.length, 'run')}; the last read ${last.boardsOk}/${last.boardsTotal} boards and ${last.scanned.toLocaleString('en-US')} postings, wrote ${plural(last.newNotes, 'new note')}, closed ${last.closed}.`);
  } else if (j.runs.length) out.push(`- **Scan**: ${plural(j.runs.length, 'dry run')} only; nothing written.`);
  if (j.found.length) {
    const top = [...j.found].sort((a, b) => b.score - a.score).slice(0, 5);
    out.push(`- **Found**: ${plural(j.found.length, 'new match', 'new matches')}. Best: ${top.map((r) => `${line(r)} (${r.score})`).join('; ')}.`);
  }
  const order = ['reviewing', 'applying', 'ready', 'applied', 'interviewing', 'offer', 'rejected', 'passed', 'new'];
  const words = { reviewing: 'shortlisted', applying: 'started applying to', ready: 'made ready', applied: 'applied to', interviewing: 'interviewing at', offer: 'offer from', rejected: 'rejected by', passed: 'passed on', new: 'put back to new' };
  for (const to of order) {
    const ms = j.byTo[to]; if (!ms?.length) continue;
    const who = [...new Set(ms.map((m) => m.via))].join(', ');
    const names = ms.slice(0, 6).map((m) => `${line(m)}${m.reason ? ` (${m.reason})` : ''}`).join('; ');
    out.push(`- **${words[to] ? words[to][0].toUpperCase() + words[to].slice(1) : to}**: ${ms.length}${ms.length > 6 ? `, including` : ''} ${names}${ms.length > 6 ? ` and ${ms.length - 6} more` : ''} (via ${who}).`);
  }
  if (j.mail.items.length) {
    const kinds = {};
    for (const i of j.mail.items.filter((i) => i.state === 'confirmed')) kinds[i.kind] = (kinds[i.kind] || 0) + 1;
    const kindText = Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(', ');
    out.push(`- **Mail**: ${plural(j.mail.confirmed, 'item')} confirmed${kindText ? ` (${kindText})` : ''}, ${j.mail.dismissed} dismissed.`);
  }
  if (j.notes.length) out.push(`- **Notes**: ${plural(j.notes.length, 'line')} added across ${new Set(j.notes.map((n) => n.id)).size} job notes.`);
  out.push('');
  return out.join('\n');
}

/** Write (or rewrite) the day's Journal section at the end of Logs/<date>.md. Returns the file and the text. */
export function writeJournal(date = isoDay()) {
  const j = buildJournal(date);
  const section = renderJournal(j);
  fs.mkdirSync(P.logs, { recursive: true });
  const file = path.join(P.logs, `${date}.md`);
  let text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : `---\ntype: log\ndate: ${date}\n---\n# ${date} — scraper log\n\n`;
  // Replace an earlier journal for the day; it is always the last section.
  const i = text.indexOf(`\n${JOURNAL_HEADING}\n`);
  if (i >= 0) text = text.slice(0, i + 1);
  if (!text.endsWith('\n\n')) text = text.replace(/\n*$/, '\n\n');
  fs.writeFileSync(file, text + section + '\n');
  return { file, journal: j, markdown: section };
}
