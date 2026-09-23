#!/usr/bin/env node
// tekjobs CLI: init a profile folder, import a resume, check onboarding, scan, serve, mcp.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const [cmd, ...rest] = process.argv.slice(2);
const opt = (f) => { const i = rest.indexOf(f); return i >= 0 ? rest[i + 1] : undefined; };
const HELP = `tekjobs — a local job-search machine

  tekjobs init [dir] [--resume <file>]   create the profile folder (default ~/.tekjobs/profile), remember it, import a resume
  tekjobs resume <file>                  import or replace the resume (PDF, DOCX, Markdown, text)
  tekjobs resume sync [<url|file>]       refresh Profile/Resume.md from where you keep your resume (a link-shared
                                         Google Doc, a public page, or a file); remembers the source; flags drafts
                                         that quote claims you removed (--dry to preview)
  tekjobs status                         what the onboarding still needs
  tekjobs scan [--dry] [--criteria <name|file>]
                                         fetch every board, score, write matches; --criteria scores this one run
                                         with a named preset from Targets/Criteria/ instead of Search Criteria.md
  tekjobs mail [--days N]                read the mailbox for application updates (confirmations, rejections,
                                         interviews) through the local CLI's Gmail connector, read tools only;
                                         matches them to notes; you confirm each one on the Today page
  tekjobs add <url> [<url>...]           add postings you found yourself (LinkedIn, a newsletter, a friend);
                                         each link is read once, scored, and written as a note unless one exists
  tekjobs rescore --from <old.json>      apply changed scoring weights to notes that already exist (--dry to preview)
  tekjobs rescore --stamp-only           record the current weights on every note without changing a score
  tekjobs rescore --full [--dry]         score every note again from the note itself under the current criteria
                                         (for location, description or seniority rule changes); notes already
                                         at these weights are left alone
  tekjobs serve                          the app + API on http://127.0.0.1:8787
  tekjobs mcp                            the MCP server on stdio (for Claude Code, Claude Desktop, ChatGPT, Cursor)

The profile folder is resolved from TEKJOBS_PROFILE, then ~/.tekjobs/config.json, then ~/.tekjobs/profile.
`;

async function main() {
  if (!cmd || cmd === 'help' || cmd === '--help') return console.log(HELP);
  if (cmd === 'init') {
    const dirArg = rest.find((a) => !a.startsWith('--') && a !== opt('--resume'));
    const dir = path.resolve(dirArg || process.env.TEKJOBS_PROFILE || path.join(process.env.USERPROFILE || process.env.HOME || '.', '.tekjobs', 'profile'));
    process.env.TEKJOBS_PROFILE = dir;
    const { initProfile, importResume, onboardingStatus } = await import('./scraper/profile.mjs');
    const r = initProfile(dir);
    console.log(`Profile folder: ${r.dir}${r.made.length ? `\n  created: ${r.made.join(', ')}` : '\n  (already existed; nothing overwritten)'}`);
    if (opt('--resume')) { const i = await importResume(path.resolve(opt('--resume')), dir); console.log(`Resume imported: ${i.chars} characters → ${i.source}`); }
    return printStatus(onboardingStatus(dir));
  }
  const { importResume, onboardingStatus } = await import('./scraper/profile.mjs');
  const { VAULT } = await import('./scraper/config.mjs');
  if (cmd === 'resume' && rest[0] === 'sync') {
    const { syncResume } = await import('./scraper/resume-sync.mjs');
    const source = rest.slice(1).find((a) => !a.startsWith('--')) || '';
    const r = await syncResume({ source, dry: rest.includes('--dry') });
    const show = (label, list, mark) => {
      if (!list.length) return;
      console.log(`\n${label} (${list.length}):`);
      for (const l of list.slice(0, 25)) console.log(`  ${mark} ${l.length > 110 ? l.slice(0, 107) + '...' : l}`);
      if (list.length > 25) console.log(`  ... and ${list.length - 25} more`);
    };
    console.log(`${r.wrote ? 'Synced' : 'Dry run, nothing written:'} ${r.kind} ${r.source} (${r.chars} characters) → ${r.note}`);
    console.log(r.previous ? `Compared with ${r.previous}.` : 'No earlier resume note to compare with.');
    if (r.previous && !r.removed.length && !r.added.length) console.log('No line changed.');
    show('Removed from the resume', r.removed, '-');
    show('Added to the resume', r.added, '+');
    if (r.stale.length) {
      console.log(`\nApplication packets still quoting claims the resume no longer makes (${r.stale.length}):`);
      for (const s of r.stale) console.log(`  ${s.note}\n    ${s.quotes.map((q) => `"${q}"`).join(', ')}`);
      console.log('Review those drafts before sending anything.');
    } else if (r.removed.length) console.log('\nNo application packet quotes a removed claim.');
    return;
  }
  if (cmd === 'resume') {
    const file = rest[0]; if (!file) return console.error('usage: tekjobs resume <file>  |  tekjobs resume sync [<url|file>] [--dry]');
    const i = await importResume(path.resolve(file)); console.log(`Resume imported: ${i.chars} characters → ${i.source}`);
    return printStatus(onboardingStatus(VAULT));
  }
  if (cmd === 'status') return printStatus(onboardingStatus(VAULT));
  if (cmd === 'scan') return run(process.execPath, [path.join(ROOT, 'run.mjs'), ...rest]);
  if (cmd === 'mail') {
    const mail = await import('./app/server/mail-check.mjs');
    const days = opt('--days') ? Number(opt('--days')) : undefined;
    mail.start({ sinceDays: days });
    process.stdout.write('Reading the mailbox through the local CLI (Gmail read tools only)');
    while (mail.items().running) { await new Promise((r) => setTimeout(r, 3000)); process.stdout.write('.'); }
    const s = mail.items(); console.log('');
    if (s.error) { console.error(s.error); process.exitCode = 1; return; }
    const pending = s.items.filter((i) => i.state === 'pending');
    console.log(`${s.items.length} application emails on file, ${pending.length} waiting for a decision. Confirm them on the Today page.`);
    for (const i of pending.slice(0, 40)) console.log(`  ${i.date}  ${i.kind.padEnd(12)} ${i.company} — ${i.role || '(role not stated)'}  → ${i.match === 'none' ? 'no note: would create one' : `${i.match} match, ${i.noteStatus}: ${i.suggestion.action}${i.suggestion.status ? ' ' + i.suggestion.status : ''}`}`);
    return;
  }
  if (cmd === 'add') {
    const urls = rest.filter((a) => !a.startsWith('--'));
    if (!urls.length) return console.error('usage: tekjobs add <url> [<url>...] [--dry]');
    const { importLink } = await import('./scraper/import-link.mjs');
    for (const u of urls) {
      const r = await importLink(u, { dry: rest.includes('--dry') });
      if (!r.ok) { console.log(`  x ${u}\n    ${r.error}`); continue; }
      const head = `${String(r.score).padStart(4)}  ${r.job.company} — ${r.job.title}  [${r.job.location || 'location n/a'}]`;
      if (r.added) console.log(`  + ${head}\n    ${r.note}${r.belowMin ? '\n    (below the scan\'s minimum score; written anyway because you asked for it)' : ''}`);
      else if (r.dry) console.log(`  · ${head}\n    would write ${r.note}`);
      else console.log(`  = ${head}\n    already here: ${r.reason}\n    ${r.existing}`);
    }
    return;
  }
  if (cmd === 'rescore') {
    const { rescore, rescoreFull } = await import('./scraper/rescore.mjs');
    const dry = rest.includes('--dry');
    if (rest.includes('--full')) {
      const r = rescoreFull({ dry });
      const bar = (await import('./scraper/config.mjs')).loadCriteria().minScore || 0;
      const crossed = r.changes.filter((c) => (c.stored >= bar) !== (c.updated >= bar));
      console.log(`${r.changed} of ${r.considered} notes ${dry ? 'would change' : 'updated'} under weights ${r.fingerprint}; ${r.alreadyCurrent} already carried them.`);
      console.log(`${crossed.filter((c) => c.updated >= bar).length} rise above the bar (${bar}), ${crossed.filter((c) => c.updated < bar).length} fall below it.`);
      for (const c of r.changes.slice(0, 15)) console.log(`  ${String(c.stored).padStart(4)} -> ${String(c.updated).padStart(4)}  ${c.company} — ${c.title.trim().slice(0, 50)}${c.status && c.status !== 'new' ? `  [${c.status}]` : ''}`);
      if (dry) console.log('\nNothing written. Run without --dry to apply.');
      return;
    }
    if (rest.includes('--stamp-only')) {
      const r = rescore({ dry, stampOnly: true });
      console.log(`${r.changed} of ${r.total} notes ${dry ? 'would be' : ''} stamped with weights ${r.fingerprint}.`);
      return;
    }
    const fromIdx = rest.indexOf('--from');
    const fromPath = fromIdx >= 0 ? rest[fromIdx + 1] : null;
    if (!fromPath) {
      console.error([
        'rescore needs the criteria your notes were scored under:',
        '  tekjobs rescore --from <old-criteria.json> [--dry]',
        '',
        'A note records its score but not the weights behind it, so without the old ones this would double-apply.',
      ].join('\n'));
      process.exitCode = 1;
      return;
    }
    const before = JSON.parse(fs.readFileSync(fromPath, 'utf8'));
    const r = rescore({ dry, before });
    console.log(`${r.changed} of ${r.total} notes ${dry ? 'would change' : 'updated'}.`);
    for (const c of r.changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 10)) {
      console.log(`  ${String(c.stored).padStart(4)} -> ${String(c.updated).padStart(4)} (${c.delta > 0 ? '+' : ''}${c.delta})  ${c.company} — ${c.title.trim().slice(0, 44)}`);
    }
    if (dry) console.log('\nNothing written. Run without --dry to apply.');
    return;
  }
  if (cmd === 'serve') return run(process.execPath, [path.join(ROOT, 'app', 'server', 'index.mjs')]);
  if (cmd === 'mcp') return run(process.execPath, [path.join(ROOT, 'app', 'server', 'mcp.mjs')]);
  console.error(`unknown command "${cmd}"\n`); console.log(HELP); process.exit(1);
}
function printStatus(s) {
  console.log(`\nOnboarding for ${s.dir}:`);
  for (const st of s.steps) console.log(`  ${st.done ? '✓' : '·'} ${st.label}${st.done ? '' : `   → ${st.how}`}`);
  console.log(s.complete ? '\nAll set. The daily scan takes it from here.' : '\nNext: the first unchecked line above.');
}
function run(bin, args) { const p = spawn(bin, args, { stdio: 'inherit', env: process.env }); p.on('close', (c) => process.exit(c ?? 0)); }
main().catch((e) => { console.error(e.message); process.exit(1); });
