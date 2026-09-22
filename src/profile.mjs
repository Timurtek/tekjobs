// Profile folder lifecycle: create it, import a resume, report what is still missing, save the interview's output.
// Shared by the CLI (cli.mjs), the API server and the MCP server.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { P, VAULT, rememberProfileDir, loadCriteria } from './config.mjs';
import { extractText } from './resume.mjs';

const STARTER = fileURLToPath(new URL('./starter/', import.meta.url));
const today = () => new Date().toISOString().slice(0, 10);

/** Create the folder layout and starter notes in `dir` (default: the resolved profile dir). Never overwrites. */
export function initProfile(dir = VAULT) {
  const made = [];
  const mk = (rel, content) => {
    const file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file)) return;
    fs.writeFileSync(file, content);
    made.push(rel);
  };
  for (const d of ['Profile', 'Targets', 'Jobs', 'Logs', '.tekjobs']) fs.mkdirSync(path.join(dir, d), { recursive: true });
  mk('Profile/Profile.md', fs.readFileSync(path.join(STARTER, 'profile.md'), 'utf8').replace('{{date}}', today()));
  mk('Targets/Search Criteria.md', criteriaNote(fs.readFileSync(path.join(STARTER, 'criteria.json'), 'utf8').trim()));
  mk('Targets/Companies.md', companiesNote(fs.readFileSync(path.join(STARTER, 'companies-table.md'), 'utf8')));
  mk('README.md', readme(dir));
  rememberProfileDir(dir);
  return { dir, made };
}

/** Copy a resume into Profile/ and write its extracted text beside it as `Resume - Source.md`. */
export async function importResume(file, dir = VAULT) {
  if (!fs.existsSync(file)) throw Object.assign(new Error(`No such file: ${file}`), { status: 404 });
  const text = await extractText(file);
  if (text.trim().length < 200) throw Object.assign(new Error('The resume text came out nearly empty. If it is a scanned PDF, export it as text or DOCX first.'), { status: 422 });
  const profileDir = path.join(dir, 'Profile');
  fs.mkdirSync(profileDir, { recursive: true });
  const dest = path.join(profileDir, `Resume - Original${path.extname(file).toLowerCase()}`);
  if (path.resolve(file) !== path.resolve(dest)) fs.copyFileSync(file, dest);
  const md = `---\ntype: resume-source\nimported: ${today()}\noriginal: ${JSON.stringify(path.basename(file))}\n---\n# Resume, as imported\n\n> Text extracted from the original by \`tekjobs resume\`. The interview reads this; the polished resume drafts live in their own notes.\n\n${text}\n`;
  fs.writeFileSync(path.join(profileDir, 'Resume - Source.md'), md);
  return { original: dest, source: path.join(profileDir, 'Resume - Source.md'), chars: text.length };
}

/** What the onboarding still needs. Drives the CLI, the app's Onboarding screen and the MCP status tool. */
export function onboardingStatus(dir = VAULT) {
  const exists = (rel) => fs.existsSync(path.join(dir, rel));
  const read = (rel) => { try { return fs.readFileSync(path.join(dir, rel), 'utf8'); } catch { return ''; } };
  const profile = read('Profile/Profile.md');
  const profileFilled = !!profile && !/^status: draft$/m.test(profile) && !/\(The interview fills this in/.test(profile);
  let criteria = null; let criteriaFilled = false;
  try { criteria = loadCriteria(); criteriaFilled = Object.keys(criteria.titleTerms || {}).length > 0; } catch { /* absent or invalid */ }
  const jobs = exists('Jobs') ? fs.readdirSync(path.join(dir, 'Jobs')).filter((f) => f.endsWith('.md')).length : 0;
  const steps = [
    { id: 'folder', label: 'Profile folder exists', done: exists('Targets/Search Criteria.md') && exists('Targets/Companies.md'), how: 'tekjobs init [dir]' },
    { id: 'resume', label: 'Resume imported', done: exists('Profile/Resume - Source.md') || (exists('Profile') && fs.readdirSync(path.join(dir, 'Profile')).some((f) => /^Resume.*\.md$/i.test(f))), how: 'tekjobs resume <file.pdf|docx|md>' },
    { id: 'profile', label: 'Profile written by the interview', done: profileFilled, how: 'Run the interview: in Claude Code (or any MCP client connected to tekjobs), ask it to call onboarding_materials and interview you.' },
    { id: 'criteria', label: 'Search criteria filled (title terms set)', done: criteriaFilled, how: 'The interview writes them; or edit Targets/Search Criteria.md.' },
    { id: 'scan', label: 'First scan has run', done: jobs > 0, how: 'tekjobs scan, or the Runs screen.' },
  ];
  return { dir, steps, complete: steps.every((s) => s.done), jobs, profilePath: path.join(dir, 'Profile', 'Profile.md') };
}

/** Everything the interviewing LLM needs in one call: resume text, current notes, and the script to follow. */
export function onboardingMaterials(dir = VAULT) {
  const read = (rel) => { try { return fs.readFileSync(path.join(dir, rel), 'utf8'); } catch { return ''; } };
  let criteriaRaw = '';
  const m = read('Targets/Search Criteria.md').match(/```json\s*\n([\s\S]*?)\n```/); if (m) criteriaRaw = m[1];
  return {
    status: onboardingStatus(dir),
    resumeText: read('Profile/Resume - Source.md').replace(/^---[\s\S]*?---\n/, ''),
    profile: read('Profile/Profile.md'),
    criteria: criteriaRaw,
    script: INTERVIEW_SCRIPT,
  };
}

export function saveProfile(markdown, dir = VAULT) {
  if (!markdown || markdown.trim().length < 100) throw Object.assign(new Error('Profile is too short to save; write the full note.'), { status: 400 });
  let md = markdown.replace(/^status: draft$/m, 'status: interviewed');
  if (!/^---\n/.test(md)) md = `---\ntype: profile\nupdated: ${today()}\nstatus: interviewed\n---\n${md}`;
  md = md.replace(/^updated: .*$/m, `updated: ${today()}`);
  const file = path.join(dir, 'Profile', 'Profile.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) fs.copyFileSync(file, path.join(dir, 'Profile', `Profile.before-${today()}.md`));
  fs.writeFileSync(file, md);
  return { saved: file };
}

/** Fetch a public page (portfolio, GitHub, LinkedIn export is a file, not a URL) as text for the interview to summarize. */
export async function fetchLink(url, { maxChars = 20000 } = {}) {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw Object.assign(new Error('Only http(s) URLs.'), { status: 400 });
  const res = await fetch(u, { headers: { 'user-agent': 'TekJobs/1.0 (onboarding; fetching a link the user gave)', accept: 'text/html,text/plain,application/json' }, signal: AbortSignal.timeout(20000), redirect: 'follow' });
  const html = await res.text();
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();
  return { url, status: res.status, chars: text.length, text: text.slice(0, maxChars), truncated: text.length > maxChars };
}

const INTERVIEW_SCRIPT = `You are onboarding a job seeker into TekJobs. Goal: write Profile/Profile.md and the criteria JSON so the daily scan finds the right roles for THIS person. Be direct and specific; no filler.

1. Read resumeText. Extract: name, location, current role and dates, the last three roles, stack and tools, quantified outcomes (numbers, scale, team size), and the through-line of the career. If the resume is missing, ask the user to run \`tekjobs resume <file>\` or paste it.
2. Ask the user, in ONE message, only what the resume cannot tell you (skip anything already clear):
   - Target titles (2 to 6). Offer a guess from the resume and let them edit it.
   - Seniority they are applying at (senior / staff / lead / principal / manager).
   - Work mode: remote only, hybrid, on-site; and where they live.
   - Pay floor (base), and a stretch band under it they would still look at.
   - Must-have keywords (stack, domain) and hard exclusions (titles, industries, company types).
   - Company stage or size preference, if any.
   - Links: portfolio, GitHub, personal site. Fetch each with fetch_link and fold what you learn into the profile. LinkedIn: ask for their data-export ZIP contents or a pasted summary; never scrape a LinkedIn page.
   - Earliest start date.
3. Write Profile/Profile.md using the existing note's headings (Basics · What you are, in three sentences · Target roles table with tiers A/B · Constraints & preferences · Proof points · Documents). Proof points are one line each, with numbers. Call save_profile with the full markdown.
4. Build the criteria from the current JSON (keep every key). Set:
   - titleTerms: exact lowercase substrings that appear in real job titles for the target roles, weighted 40 for exact-fit titles down to ~20 for adjacent ones. Include common variants ("front-end", "frontend", "front end").
   - titleExclude: add the user's hard exclusions as lowercase substrings.
   - descTerms: 15 to 30 stack/domain words with weights 2 to 6.
   - salary.minAnnual and salary.stretchAnnual as integers (or null if the user declines).
   - location.requireRemote true only if the user said remote only; add their metro to bayAreaTerms with bayAreaBoost 12 if hybrid there is acceptable.
   Call set_criteria with the full JSON string. It is validated before writing.
5. Call run_scan with dry=true, wait with scan_status until it finishes, then search_jobs kind=all limit=15 and show the user the top matches with score, pay band and one reason each. Ask whether the list looks right. Adjust criteria once if not, then run a real scan (dry=false).
6. Finish by telling the user where things live: Profile/Profile.md, Targets/Search Criteria.md, Jobs/. Remind them the daily scan runs on its own from here.`;

function criteriaNote(json) {
  return `---
type: config
updated: ${today()}
---
# Search Criteria

> **The scraper reads the JSON block below.** The onboarding interview fills it from your resume and your answers; after that, edit it here. Weights are additive points. A job needs \`minScore\` to get its own note in \`Jobs/\`.

How scoring works:
- **titleTerms** — best single match in the job title counts fully, each extra match adds 5. Empty until the interview runs.
- **titleExclude** — any hit in the title drops the job entirely.
- **noTitleMatchPenalty** — a posting whose title matches nothing in \`titleTerms\` takes this hit, so location and recency alone can't carry it over the bar.
- **descTerms** — each term found in the description adds its weight (capped at \`descCap\`).
- **seniority** — senior/staff/lead/principal adds; junior/intern subtracts.
- **location** — remote adds; with \`requireRemote\` on, anything not remote takes \`notRemotePenalty\` and drops out. Clearly non-US-only listings subtract heavily.
- **salary** — a stated range at or above \`minAnnual\` adds; between \`stretchAnnual\` and \`minAnnual\` is the stretch band (small penalty, kept visible); below subtracts. No stated range is neutral.
- **recency** — posted within 7 days adds, over 90 days subtracts.
- **openSources** — aggregator feeds that need no company slug. Set one to \`false\` to drop it. \`wellfound\` and \`builtin\` read those sites' remote listing pages (no API), searched by design-engineering roles; both lose to the same job from its ATS when both turn up.
- **email** — job alert emails you save into the \`Inbox\` folder of this profile, as \`.eml\`. This is how the boards with no public API get in: LinkedIn, Indeed, Otta and Wellfound all send alerts, and an email in your own mailbox is your own data. Nothing contacts those sites — it reads files you put there, and the links are for you to open. Links to Greenhouse, Lever, Ashby and Workday are picked up from any sender. Rows are thin (a title, a company, usually a location), so they score below the same job from an ATS and lose to it when both turn up.
- **adzuna** — the one source that needs a key. Set \`ADZUNA_APP_ID\` and \`ADZUNA_APP_KEY\` in the environment (free at developer.adzuna.com), turn \`openSources.adzuna\` on, and it searches your top \`titleTerms\` in each country under \`adzuna.countries\`. It reaches listings that never appear on a company ATS board, but its descriptions come back as snippets, so those rows score lower than the same job fetched from its ATS.
- **usajobs** — every US federal posting. Set \`USAJOBS_API_KEY\` and \`USAJOBS_EMAIL\` (free at developer.usajobs.gov; the email is the one the key is registered to) and turn \`openSources.usajobs\` on. Unlike Adzuna it returns the whole description, so these rows score on equal footing, and it carries a real application deadline.

\`\`\`json
${json}
\`\`\`
`;
}

function companiesNote(table) {
  return `---
type: config
updated: ${today()}
---
# Company Watchlist

> **The scraper reads the table below.** Add a row to start watching a company; delete a row to stop. \`ATS\` names the platform; \`Slug\` is the company's board token on that platform (for Greenhouse, Lever, Ashby: the part of the URL after \`boards.greenhouse.io/\`, \`jobs.lever.co/\`, or \`jobs.ashbyhq.com/\`). Tier is yours (A = dream, B = strong, C = fine). The scraper rewrites the \`Status\` column on every run: \`ok · N\` or \`bad-slug\`.

Platforms: \`greenhouse\`, \`lever\`, \`ashby\`, \`workday\` (slug \`host/tenant/site\`), \`rippling\`, \`smartrecruiters\`, \`workable\`, \`bamboohr\`, \`breezy\`, \`personio\`, \`teamtailor\`, \`eightfold\` (slug \`host/domain\`), and single-company fetchers \`atlassian\`, \`github\`, \`spotify\`, \`amazon\`, \`google\`, \`apple\` (slug \`-\`; Google and Apple are read from their career pages, keyword-searched, mostly on-site roles). Aggregators with no slug are toggled in [[Targets/Search Criteria]] under \`openSources\`.

This starter list is the community registry: tech companies whose boards answer without a login. Cut it to what you care about, or add your own.

${table}`;
}

function readme(dir) {
  return `# TekJobs profile folder

This folder is your job search: profile, resume, criteria, watchlist, one note per matched job, and logs. It is plain markdown. Open it in Obsidian or any editor; the TekJobs app and its MCP server read and write the same files.

- \`Profile/Profile.md\` — who you are and what you want (written by the onboarding interview)
- \`Profile/Resume - Source.md\` — your resume as text
- \`Targets/Search Criteria.md\` — how postings are scored (JSON block)
- \`Targets/Companies.md\` — which boards are watched
- \`Jobs/\` — one note per match; change \`status:\` to move it through the pipeline
- \`Logs/\` — what each scan found
- \`.tekjobs/\` — scan state (safe to delete; the next scan rebuilds it, existing notes are never overwritten)

Folder: ${dir}
`;
}
