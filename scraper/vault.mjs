import fs from 'node:fs';
import path from 'node:path';
import { P, VAULT } from './config.mjs';
import { weightsFingerprint } from './rescore.mjs';

const today = () => new Date().toISOString().slice(0, 10);
const yaml = (v) => JSON.stringify(v ?? '');
const safe = (s) => (s || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 70);
// The tail of the id becomes part of the filename, so only word characters may reach it. A link id ends in a
// URL, and a URL's trailing slash became a path separator on Windows: "Meta - … (2149585\).md" did not exist.
const shortId = (id) => String(id).split(':').pop().replace(/[^A-Za-z0-9_-]+/g, '').slice(-8) || 'link';

export function loadSeen() {
  try { return JSON.parse(fs.readFileSync(P.seen, 'utf8')); } catch { return {}; }
}
export function saveSeen(seen) {
  fs.writeFileSync(P.seen, JSON.stringify(seen, null, 2));
}

/**
 * The Narrative line the note template used to pre-fill, before it was emptied.
 *
 * It named one person's positioning in every note the scraper wrote, which is wrong for anyone else's vault.
 * Kept here because notes written before the change still carry it, and something has to be able to tell that
 * line apart from a narrative a reader actually chose.
 */
export const LEGACY_NARRATIVE_DEFAULT = 'Design Engineer leads, AI work as proof (see [[Profile/Positioning]])';

export function jobNotePath(job) {
  return path.join(P.jobs, `${safe(job.company)} - ${safe(job.title)} (${shortId(job.id)}).md`);
}

export function writeJobNote(job, scored, criteria) {
  const file = jobNotePath(job);
  // Never overwrite a note that exists: it may carry the person's status and notes. (Guards a lost or reset seen.json.)
  if (fs.existsSync(file)) return file;
  const desc = (job.descriptionText || '').slice(0, criteria.maxDescriptionChars ?? 6000);
  const truncated = (job.descriptionText || '').length > desc.length;
  const posted = job.posted ? String(job.posted).slice(0, 10) : '';
  const fm = [
    '---',
    'type: job',
    'status: new',
    'listing: open',
    `company: ${yaml(job.company)}`,
    `title: ${yaml(job.title)}`,
    `location: ${yaml(job.location)}`,
    `remote: ${job.remote ? 'true' : 'false'}`,
    `source: ${job.source}`,
    `url: ${yaml(job.url)}`,
    `score: ${scored.score}`,
    // Which weights produced that score, so `tekjobs rescore` can tell an adjusted note from an untouched one.
    `weights: ${weightsFingerprint(criteria)}`,
    `posted: ${yaml(posted)}`,
    `found: ${today()}`,
    `salary: ${yaml(job.salary)}`,
    `salary_max: ${job.salaryMax || ''}`,
    `pay_band: ${scored.payBand || 'unknown'}`,
    `department: ${yaml(job.department)}`,
    `job_id: ${yaml(job.id)}`,
    // Only on notes that did not come from the scan, so a scanned note keeps the shape it always had.
    ...(job.foundVia ? [`added_by: ${job.addedBy || 'link'}`] : []),
    `tags: [job${scored.payBand === 'stretch' ? ', stretch' : ''}]`,
    '---',
  ].join('\n');

  const body = `
# ${job.title} @ ${job.company}

**[Open posting](${job.url})** · ${job.location || 'location n/a'} · ${job.remote ? 'Remote' : 'On-site/Hybrid'} · score **${scored.score}**${job.salary ? ` · ${job.salary}` : ''}

## Why it matched
${scored.reasons.map((r) => `- ${r}`).join('\n')}

## Status log
- ${today()} — ${job.foundVia || 'found by scraper'} (score ${scored.score}). Set \`status:\` above to \`reviewing\`, \`applying\`, \`applied\`, \`interviewing\`, \`offer\`, \`rejected\`, or \`passed\`.

## Notes


## Application
- **Narrative:**
- **Resume variant:**
- **Cover letter:**
- **Applied on:**
- **Contact / referral:**
- **Follow-up due:**

## Job description
> Source: ${job.source}${job.thread ? ` · ${job.thread}` : ''}${truncated ? ' · truncated, open the posting for the full text' : ''}

${desc}
`;
  fs.writeFileSync(file, fm + '\n' + body);
  return file;
}

/** Minimal frontmatter reader: --- key: value --- */
export function readFrontmatter(file) {
  let txt;
  try { txt = fs.readFileSync(file, 'utf8'); } catch { return null; }
  const m = txt.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (/^".*"$/.test(v)) { try { v = JSON.parse(v); } catch { /* keep */ } }
    fm[k] = v;
  }
  fm._file = file;
  fm._name = path.basename(file, '.md');
  return fm;
}

export function allJobNotes() {
  if (!fs.existsSync(P.jobs)) return [];
  return fs.readdirSync(P.jobs).filter((f) => f.endsWith('.md')).map((f) => readFrontmatter(path.join(P.jobs, f))).filter(Boolean);
}

/** Mark notes whose listing vanished from a successfully fetched board. Only touches the `listing:` line. */
export function markClosedListings(liveIdsByCompanyKey, seen) {
  const closed = [];
  for (const [id, rec] of Object.entries(seen)) {
    if (!rec.path || !fs.existsSync(rec.path)) continue;
    const key = rec.companyKey;
    if (!key || !(key in liveIdsByCompanyKey)) continue; // board not fetched this run
    if (liveIdsByCompanyKey[key].has(id)) continue;
    const txt = fs.readFileSync(rec.path, 'utf8');
    if (!/^listing: open$/m.test(txt)) continue;
    fs.writeFileSync(rec.path, txt.replace(/^listing: open$/m, `listing: closed ${today()}`));
    closed.push(rec);
  }
  return closed;
}

export function appendLog(lines) {
  const file = path.join(P.logs, `${today()}.md`);
  const header = fs.existsSync(file) ? '' : `---\ntype: log\ndate: ${today()}\n---\n# ${today()} — scraper log\n\n`;
  fs.appendFileSync(file, header + lines.join('\n') + '\n\n');
  return file;
}

const link = (fm) => `[[Jobs/${fm._name}|open]]`;
const row = (cells) => `| ${cells.map((c) => String(c ?? '').replace(/\|/g, '\\|')).join(' | ')} |`;

export function writeDashboard(summary) {
  const notes = allJobNotes();
  const byStatus = {};
  for (const n of notes) (byStatus[n.status || 'new'] ||= []).push(n);
  const order = ['new', 'reviewing', 'applying', 'applied', 'interviewing', 'offer', 'rejected', 'passed'];
  const statuses = [...order.filter((s) => byStatus[s]), ...Object.keys(byStatus).filter((s) => !order.includes(s))];

  const newOpen = (byStatus.new || []).filter((n) => String(n.listing).startsWith('open')).sort((a, b) => Number(b.score) - Number(a.score));
  const active = notes.filter((n) => ['applying', 'applied', 'interviewing', 'offer'].includes(n.status));
  const closedNew = (byStatus.new || []).filter((n) => String(n.listing).startsWith('closed'));

  const out = [];
  out.push('---', 'type: dashboard', `generated: ${new Date().toISOString()}`, '---');
  out.push('# TekJobs — Home');
  out.push(`> Generated by the scraper. Edits here get overwritten; write in the job notes or [[Applications/Pipeline Notes]].`);
  out.push('');
  out.push(`**Last run:** ${summary.when} · ${summary.companiesOk}/${summary.companiesTotal} boards fetched (${summary.companiesFailed} failed) · ${summary.totalJobs} postings scanned · **${summary.newMatches} new matches** · log: [[Logs/${today()}]]`);
  out.push('');
  out.push('## Needs you');
  out.push(`- **${newOpen.length}** new matches waiting for a first look (below).`);
  out.push(`- Open profile questions in [[Profile/Profile]] (comp, remote vs hybrid, which narrative leads).`);
  if (summary.companiesFailed) out.push(`- ${summary.companiesFailed} company slugs failed; see the Status column in [[Targets/Companies]].`);
  out.push('');
  out.push('## Pipeline');
  out.push(row(['Status', 'Count']), row(['---', '---']));
  for (const s of statuses) out.push(row([s, byStatus[s].length]));
  out.push('');
  out.push(`## New matches — top ${Math.min(40, newOpen.length)} of ${newOpen.length} by score`);
  const bandMark = (n) => ({ floor: '✅ floor', stretch: '↗ stretch', below: '↓ below', unknown: '' })[n.pay_band || 'unknown'];
  out.push(row(['Score', 'Company', 'Role', 'Location', 'Pay', 'Band', 'Posted', 'Note']), row(['---', '---', '---', '---', '---', '---', '---', '---']));
  for (const n of newOpen.slice(0, 40)) out.push(row([n.score, n.company, `[${n.title}](${n.url})`, n.location, n.salary || '', bandMark(n), n.posted, link(n)]));
  const stretch = newOpen.filter((n) => n.pay_band === 'stretch');
  if (stretch.length) {
    out.push('');
    out.push(`## Stretch band — stated pay $180k to $220k (${stretch.length})`);
    out.push('_Visible on purpose, scored slightly down. Senior-level roles that would want a negotiation to reach the floor._');
    out.push(row(['Score', 'Company', 'Role', 'Pay', 'Note']), row(['---', '---', '---', '---', '---']));
    for (const n of stretch.slice(0, 25)) out.push(row([n.score, n.company, `[${n.title}](${n.url})`, n.salary || '', link(n)]));
  }
  out.push('');
  out.push('## Active applications');
  if (!active.length) out.push('_None yet._');
  else {
    out.push(row(['Status', 'Company', 'Role', 'Found', 'Note']), row(['---', '---', '---', '---', '---']));
    for (const n of active) out.push(row([n.status, n.company, `[${n.title}](${n.url})`, n.found, link(n)]));
  }
  out.push('');
  if (closedNew.length) {
    out.push('## Listings that closed before review');
    for (const n of closedNew.slice(0, 20)) out.push(`- ${n.company} — ${n.title} (${n.listing}) ${link(n)}`);
    out.push('');
  }
  out.push('## Map');
  out.push('- [[Profile/Profile]] · [[Profile/Resume - Master]] · [[Profile/Positioning]]');
  out.push('- [[Targets/Search Criteria]] · [[Targets/Companies]]');
  out.push('- [[Templates/Cover Letter]] · [[Templates/Outreach]] · [[Automation/README]]');
  out.push('');
  fs.writeFileSync(P.home, out.join('\n'));
  return { newOpen: newOpen.length, active: active.length };
}

export { VAULT };
