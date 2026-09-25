#!/usr/bin/env node
// tekjobs CLI: init a profile folder, import a resume, check onboarding, scan, serve, mcp.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
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
  tekjobs --version                      the installed version
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
  tekjobs schedule [--time HH:MM] [--print]
                                         run the scan and the mail read every morning: creates the Windows task
                                         (07:30 by default), or prints the crontab or launchd line for macOS and
                                         Linux; --print shows the command without installing anything
  tekjobs import linkedin <zip|folder>   your LinkedIn data export into the search: who you know at each
                                         company, and the recruiters who wrote
                                         [--since YYYY-MM-DD] [--everyone] [--no-people] [--preview] [--dry]
  tekjobs serve                          the app + API on http://127.0.0.1:8787
  tekjobs mcp                            the MCP server on stdio (Claude Code, Codex, Cursor, Claude Desktop)

The profile folder is resolved from TEKJOBS_PROFILE, then ~/.tekjobs/config.json, then ~/.tekjobs/profile.
`;

async function main() {
  if (!cmd || cmd === 'help' || cmd === '--help') return console.log(HELP);
  if (cmd === '--version' || cmd === '-v' || cmd === 'version') return console.log(JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version);
  if (cmd === 'schedule') return schedule();
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
  if (cmd === 'import' && rest[0] === 'linkedin') {
    const source = rest.slice(1).find((x) => !x.startsWith('--'));
    if (!source) return console.error('Usage: tekjobs import linkedin <path to the export zip or unpacked folder> [--since YYYY-MM-DD] [--everyone] [--no-people] [--preview] [--dry]\nRequest the larger archive at https://www.linkedin.com/mypreferences/d/download-my-data');
    const li = await import('./app/server/linkedin-import.mjs');
    const o = { since: opt('--since') || undefined, everyone: rest.includes('--everyone'), writePeople: !rest.includes('--no-people'), dry: rest.includes('--dry') };
    if (rest.includes('--preview')) return console.log(JSON.stringify(li.preview(source, o), null, 2));
    const s = li.runImport(source, o);
    console.log(`LinkedIn export read from ${s.source}${s.dry ? ' (dry run, nothing written)' : ''}`);
    console.log(`  ${s.counts.connections} connections indexed, ${s.counts.threads} conversations and ${s.counts.invitations} invitations since ${s.since}, ${s.counts.applications} applications, ${s.counts.savedJobs} saved jobs`);
    console.log(`  People: ${s.people.created} created, ${s.people.recognised} already there, ${s.people.attached} put on job notes, ${s.people.logged} log lines; ${s.people.skipped} senders skipped (not recruiters or hiring managers; --everyone includes them)`);
    if (!s.dry) console.log(`  Index: ${s.indexPath}. Job notes now show who you know at each company.`);
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

/**
 * The morning task. On Windows, a Task Scheduler entry that runs run.cmd (the scan, then the mail read) daily;
 * elsewhere, the crontab line or launchd plist that runs run.sh, printed for the person to install, because
 * editing a crontab unasked is not this tool's place. --print shows the Windows command without running it.
 */
function schedule() {
  // A task that runs from npx's cache breaks the first time the cache is cleaned. Install first.
  if (/[\\/]_npx[\\/]/.test(ROOT)) return console.error(`This copy of tekjobs runs from npx's cache, which does not last. Install it, then schedule from there:\n  npm install -g @timurtekb/tekjobs\n  tekjobs schedule`);
  const time = opt('--time') || '07:30';
  if (!/^\d{2}:\d{2}$/.test(time)) return console.error('--time wants HH:MM, for example 07:30');
  const [hh, mm] = time.split(':').map(Number);
  const printOnly = rest.includes('--print');
  if (process.platform === 'win32') {
    const cmd = `schtasks /Create /F /SC DAILY /ST ${time} /TN "TekJobs Daily Scan" /TR "\\"${path.join(ROOT, 'run.cmd')}\\""`;
    console.log(`Windows Task Scheduler entry "TekJobs Daily Scan", daily at ${time}, running run.cmd (the scan, then the mail read):\n  ${cmd}`);
    if (printOnly) return;
    const r = spawnSync(cmd, { shell: true, encoding: 'utf8' });
    if (r.status === 0) console.log('Installed. See it in Task Scheduler, or remove it with: schtasks /Delete /TN "TekJobs Daily Scan" /F');
    else console.error(`schtasks answered ${r.status}: ${(r.stderr || r.stdout || '').trim()}\nRun the command above in an elevated terminal if Windows asked for permission.`);
    return;
  }
  const sh = path.join(ROOT, 'run.sh');
  console.log(`Add one line to your crontab (crontab -e), daily at ${time}:\n  ${mm} ${hh} * * * ${sh}\n`);
  if (process.platform === 'darwin') {
    const plist = path.join(process.env.HOME || '~', 'Library', 'LaunchAgents', 'com.tekjobs.scan.plist');
    console.log(`Or, on macOS, a launchd agent (it survives sleep better than cron):
  cat > ${plist} <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.tekjobs.scan</string>
  <key>ProgramArguments</key><array><string>/bin/sh</string><string>${sh}</string></array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>${hh}</integer><key>Minute</key><integer>${mm}</integer></dict>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string></dict>
</dict></plist>
EOF
  launchctl load ${plist}`);
  }
  console.log('\nBoth run run.sh: the scan, then the read-only mail pass, appending to data/runs.log.');
}
