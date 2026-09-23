#!/usr/bin/env node
// Builds samples/vault: a complete, fictional profile folder for demos, screenshots and first looks. Every
// note is written by the same code the product uses (initProfile, writeJobNote, setStatus, the packet, the
// people notes, the log and the dashboard), so the sample is always in the shape the app expects. Nothing in
// it is a real person, company or posting; every domain is example.com or a reserved test name.
//
//   npm run sample            rebuild samples/vault from scratch
//   TEKJOBS_PROFILE=$PWD/samples/vault npm run serve     look at it in the app
//
// Dates are relative to today, so the sample looks fresh when generated; rebuild it before a demo.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'samples', 'vault');

// The product's modules resolve the profile folder and the home directory when they load, so both are pointed
// at the sample (and at a throwaway home, so initProfile's "remember this folder" never touches yours).
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'tekjobs-sample-home-'));
process.env.TEKJOBS_PROFILE = OUT;
process.env.USERPROFILE = HOME;
process.env.HOME = HOME;

const { initProfile } = await import('../scraper/profile.mjs');
const { writeJobNote, appendLog, writeDashboard } = await import('../scraper/vault.mjs');
const { scoreJob } = await import('../scraper/score.mjs');
const { loadCriteria, P } = await import('../scraper/config.mjs');
const store = await import('../app/server/store.mjs');
const people = await import('../app/server/people.mjs');

// Every writer stamps "today". To give the sample a believable timeline (found three weeks ago, applied twelve
// days ago), the clock is moved back for the duration of one write and restored after.
const RealDate = Date;
const DAY = 864e5;
const at = (daysAgo, fn) => {
  const t = RealDate.now() - daysAgo * DAY;
  globalThis.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(t); } static now() { return t; } };
  try { return fn(); } finally { globalThis.Date = RealDate; }
};
const iso = (daysAgo) => new RealDate(RealDate.now() - daysAgo * DAY).toISOString();
const day = (daysAgo) => iso(daysAgo).slice(0, 10);

// 1. The folder, the starter notes, then the person's own notes.
initProfile(OUT);
const write = (rel, text) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text.trimStart()); };

write('Profile/Profile.md', `
---
type: profile
updated: ${day(20)}
status: reviewed
---
# Candidate profile

> Written by the onboarding interview from the resume and the answers. Edit freely; the scan does not read this note (it reads [[Targets/Search Criteria]]), but every application draft does.

## Basics
- **Name:** Jordan Example
- **Location / time zone:** Portland, Oregon (Pacific)
- **Email:** jordan@example.com
- **Links:** https://jordan.example.com · https://github.com/jordan-example
- **Current role:** Staff Design Engineer, Acme Finance (through the end of next month)

## What you are, in three sentences
A design engineer who has spent eight years on the seam between design and front-end engineering: design systems, component libraries, the tooling that keeps twelve product teams shipping the same interface. Strongest at turning a Figma library into a typed, tested, documented React system that other engineers want to use, and at the accessibility work nobody else volunteers for. Wants a staff or senior role on a design-systems or product-platform team at a company that ships software people use every day, remote in the US.

## Target roles
| Tier | Titles | Why |
|---|---|---|
| A | Design Engineer, Staff Design Engineer, Design Systems Engineer | The work of the last five years, at the level it is done now. |
| B | Senior Frontend Engineer (design systems, platform), UX Engineer | Adjacent titles for the same work at companies that name it differently. |

## Constraints & preferences
- **Work mode:** remote, United States; will travel quarterly
- **Employment:** full-time
- **Pay floor and stretch:** $200k base; would look at $170k for the right team
- **Company stage / size:** 50 to 2,000 people; has a product with users
- **Industries to avoid:** defense, gambling, tobacco
- **Earliest start:** four weeks from offer

## Proof points
- Led the Acme design system from 4 to 62 components used by 12 teams; UI defect reports down a third year over year.
- Cut the Acme web app's largest bundle from 1.9 MB to 640 kB by moving the component library to ESM and per-component styles.
- Wrote the accessibility review process Acme uses for every launch; the app passed its first external WCAG 2.1 AA audit with zero blockers.
- At Widgets Inc, introduced visual regression testing that caught 41 regressions in its first quarter.

## Documents
- Resume of record: [[Profile/Resume]]
`);

write('Profile/Resume.md', `
---
type: resume
updated: ${day(20)}
source: Resume - Jordan Example.pdf
---
# Jordan Example
Staff Design Engineer · Portland, OR · jordan@example.com · jordan.example.com

## Summary
Design engineer with eight years building design systems and product front ends in React and TypeScript. Led the design system at a fintech used by two million customers; shipped component libraries used by twelve product teams; ran the accessibility program that took the product through its first external audit clean.

## Experience

### Acme Finance — Staff Design Engineer, 2021 to present
- Own the design system: 62 React and TypeScript components, tokens, Storybook, Figma library kept in step by a token pipeline.
- UI defect reports down a third year over year after the migration to the system.
- Moved the component library to ESM with per-component styles; the web app's largest bundle went from 1.9 MB to 640 kB.
- Wrote and run the accessibility review every launch goes through; first external WCAG 2.1 AA audit passed with zero blockers.
- Mentor four engineers on the platform team; run the fortnightly design-engineering guild.

### Widgets Inc — Front End Engineer, 2017 to 2021
- Built the marketing site and the application shell in React; introduced visual regression testing that caught 41 regressions in its first quarter.
- Paired with two designers to move the product to a shared component set; page build time for new screens dropped from days to hours.

### Freelance — Front End Developer, 2015 to 2017
- Sites and small applications for studios and nonprofits; HTML, CSS, JavaScript, WordPress.

## Skills
React, TypeScript, design systems, design tokens, Storybook, Figma, accessibility (WCAG 2.1, ARIA, screen-reader testing), CSS architecture, Node, testing (Playwright, Vitest, visual regression), documentation.

## Education
B.A. Graphic Design, Portland State University, 2015.
`);

write('Profile/Positioning.md', `
---
type: positioning
updated: ${day(20)}
---
# Positioning

## Which story leads
Design engineer first, always. Design systems are the proof: the numbers in the resume are system numbers (components, teams, defects, bundle size, the audit). AI work is not part of this person's story and is never claimed.

## The evidence rule
Every claim in a letter or a tailored summary traces to a line of [[Profile/Resume]]. No new numbers, no new titles, no new dates. If the posting asks for something the resume does not show, the letter says what is adjacent and true, or says nothing.

## What must never be claimed
- Management of a team (mentoring four engineers is not managing them).
- Native mobile work.
- Any AI or machine-learning delivery.
`);

write('Profile/Voice.md', `
---
type: voice
updated: ${day(20)}
---
# Voice

## Rules
- Short sentences. Plain words. No adjectives about myself.
- Name the company and the specific thing about it in the first two sentences, or do not send the letter.
- One proof point per paragraph, with its number.
- No dashes. No "passionate", "excited", "leverage", "synergy".
- Close with what I would do in the first month, not with thanks.

## A letter I would send
Hello. Your posting says the design system at Orbital covers three products and is maintained by two people. At Acme I took a system from 4 components to 62, used by 12 teams, and the UI defect rate fell by a third in the year after. The part of that work I would bring first is the token pipeline: Figma and code stopped drifting once the tokens had one source. In the first month I would read the three products' component inventories side by side and write down where they disagree, because that list is the roadmap. Jordan.
`);

// 2. Criteria: the interview's output for this person.
const criteriaRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'scraper', 'starter', 'criteria.json'), 'utf8'));
criteriaRaw.titleTerms = { 'design engineer': 40, 'design systems': 30, 'design system': 30, 'ux engineer': 25, 'frontend engineer': 15, 'front end engineer': 15, 'front-end engineer': 15, 'platform engineer': 10 };
criteriaRaw.descTerms = { 'design system': 6, 'design systems': 6, 'react': 4, 'typescript': 4, 'storybook': 4, 'figma': 3, 'accessibility': 4, 'tokens': 3, 'component library': 4, 'wcag': 3 };
criteriaRaw.salary = { ...criteriaRaw.salary, minAnnual: 200000, stretchAnnual: 170000 };
criteriaRaw.location = { ...criteriaRaw.location, requireRemote: true };
at(20, () => store.setCriteria(JSON.stringify(criteriaRaw, null, 2)));
const criteria = loadCriteria();

// 3. Fourteen postings at fictional companies. Scored with the real scorer against the criteria above, so the
// match reasons on every note are real.
const desc = (parts) => parts.join(' ');
const jobs = [
  { key: 'northwind', company: 'Northwind Labs', ats: 'greenhouse', title: 'Staff Design Engineer, Design Systems', location: 'Remote, United States', remote: true, days: 3, salaryMin: 215000, salaryMax: 265000, department: 'Product Platform', text: desc(['Northwind Labs builds tools for warehouse operators; 1,400 sites run our software every day.', 'You will own the design system that three product teams build on: React, TypeScript, Storybook, design tokens shared with Figma.', 'The first quarter is an audit of the three apps against the system and a plan for the components they still lack.', 'We care about accessibility as a shipping requirement, not a review at the end; WCAG 2.1 AA is the bar.', 'Remote in the United States; the platform team meets in Chicago twice a year.']) },
  { key: 'orbital', company: 'Orbital Software', ats: 'ashby', title: 'Senior Design Engineer', location: 'Remote (US)', remote: true, days: 6, salaryMin: 190000, salaryMax: 230000, department: 'Design', text: desc(['Orbital makes scheduling software for clinics.', 'Our design system covers three products and is maintained by two people; you would be the third, and the one who owns the component library end to end.', 'React and TypeScript, Storybook for documentation, Figma as the source of truth for tokens.', 'You will pair with designers weekly and with product engineers daily.', 'Fully remote in the US.']) },
  { key: 'lumen', company: 'Lumen Health', ats: 'lever', title: 'Design Systems Engineer', location: 'Remote US · Denver, CO', remote: true, days: 12, salaryMin: 175000, salaryMax: 205000, department: 'Engineering', text: desc(['Lumen Health runs a patient portal used by 900 clinics.', 'We are rebuilding the front end on a shared component library and need an engineer who has done this before: tokens, theming, accessibility, documentation in Storybook.', 'TypeScript and React; some Angular remains and you would help retire it.', 'Remote in the US or Denver.']) },
  { key: 'fjord', company: 'Fjord Analytics', ats: 'greenhouse', title: 'Staff Frontend Engineer, Platform', location: 'Remote, United States', remote: true, days: 9, salaryMin: 220000, salaryMax: 270000, department: 'Platform', text: desc(['Fjord Analytics is a data platform for mid-size retailers.', 'The platform team owns the web application shell, the build, the design system and the component library that eleven feature teams use.', 'You would lead the component library: React, TypeScript, tokens, Storybook, performance budgets.', 'Experience taking a system through an accessibility audit is a strong signal.', 'Remote in the US.']) },
  { key: 'halcyon', company: 'Halcyon Robotics', ats: 'ashby', title: 'Senior UX Engineer', location: 'Remote (United States) · Boston, MA', remote: true, days: 15, salaryMin: 180000, salaryMax: 215000, department: 'Product', text: desc(['Halcyon builds fleet software for warehouse robots.', 'The UX engineering team sits between design and the product engineers and owns the design system and prototyping.', 'React, TypeScript, Figma, Storybook.', 'Remote in the US, with a Boston office.']) },
  { key: 'brightline', company: 'Brightline Studio', ats: 'lever', title: 'Design Engineer', location: 'Remote · United States', remote: true, days: 1, salaryMin: 160000, salaryMax: 195000, department: 'Studio', text: desc(['Brightline is a 40-person product studio.', 'You would be our first design engineer: build the component library our client work starts from, in React and TypeScript with Storybook, and set the accessibility bar for every project.', 'Figma fluency matters; you will work in the file as much as in the editor.', 'Remote in the US.']) },
  { key: 'copperleaf', company: 'Copperleaf', ats: 'greenhouse', title: 'Principal Design Engineer', location: 'Remote - US', remote: true, days: 4, salaryMin: 240000, salaryMax: 290000, department: 'Design Systems', text: desc(['Copperleaf makes accounting software for small firms; 300,000 businesses use it.', 'The design systems team is five engineers and two designers; the principal role sets technical direction for the system across web and the embedded views in our desktop app.', 'React, TypeScript, tokens, theming for white-label partners, WCAG 2.1 AA across the board.', 'Remote in the US.']) },
  { key: 'tessellate', company: 'Tessellate', ats: 'ashby', title: 'Senior Frontend Engineer, Design Systems', location: 'Remote, US', remote: true, days: 7, salaryMin: 185000, salaryMax: 225000, department: 'Engineering', text: desc(['Tessellate is a project-management product for architecture firms.', 'You would join the two-person design systems team and own the React component library, its tokens and its Storybook.', 'TypeScript throughout; accessibility testing with screen readers is part of the definition of done.', 'Remote in the US.']) },
  { key: 'quill', company: 'Quill & Co', ats: 'lever', title: 'Design Engineer, Editor', location: 'Remote (US and Canada)', remote: true, days: 18, salaryMin: 170000, salaryMax: 210000, department: 'Editor', text: desc(['Quill makes a writing tool used by 200,000 people.', 'The editor team needs a design engineer for the toolbar, the menus, the settings surface: the parts of the product that are pure interface.', 'React, TypeScript, our own design system, Figma.', 'Remote in the US or Canada.']) },
  { key: 'meridian', company: 'Meridian Pay', ats: 'greenhouse', title: 'Staff Design Engineer', location: 'Remote, United States', remote: true, days: 21, salaryMin: 225000, salaryMax: 275000, department: 'Platform', text: desc(['Meridian Pay processes payroll for 30,000 companies.', 'The platform team owns the design system used by six product teams and the white-label theming our partners depend on.', 'You would lead the system: architecture, tokens, the component library in React and TypeScript, Storybook, accessibility, and the migration of the last two legacy apps.', 'Remote in the US.']) },
  { key: 'basalt', company: 'Basalt Systems', ats: 'ashby', title: 'Senior Design Engineer, Growth', location: 'Remote US', remote: true, days: 25, salaryMin: 180000, salaryMax: 220000, department: 'Growth', text: desc(['Basalt Systems sells infrastructure monitoring.', 'The growth team builds onboarding, pricing and the signup flow, and wants a design engineer who ships polished interface fast in React and TypeScript on our design system.', 'Remote in the US.']) },
  { key: 'verdant', company: 'Verdant', ats: 'greenhouse', title: 'UX Engineer', location: 'Remote (United States)', remote: true, days: 30, salaryMin: 165000, salaryMax: 190000, department: 'Design', text: desc(['Verdant is a climate-reporting product for property owners.', 'The UX engineer owns prototypes and the component library, in React and TypeScript with Storybook, and runs accessibility reviews.', 'Remote in the US.']) },
  { key: 'signalfire', company: 'Signalfire Design', ats: 'lever', title: 'Design Engineer', location: 'Austin, TX (hybrid)', remote: false, days: 2, salaryMin: 170000, salaryMax: 200000, department: 'Design', text: desc(['Signalfire is a brand and product design agency in Austin.', 'The design engineer builds the client prototypes and our internal component kit in React and TypeScript.', 'Hybrid, three days a week in the Austin studio.']) },
  { key: 'tekjobs', company: 'Example Studio', ats: 'tekjobs', title: 'Senior Design Engineer', location: 'Remote · United States', remote: true, days: 0, salaryMin: 180000, salaryMax: 240000, department: 'Product Design', text: desc(['Example Studio is a fictional company whose posting exists to show what an employer posting on TekJobs looks like on the board.', 'The role owns the product surface end to end: the React front end, the design system the team ships on, and the accessibility bar.', 'TypeScript, Storybook, Figma tokens.', 'Remote in the United States.']) },
];
const money = (n) => `$${Math.round(n / 1000)}k`;
const ids = {};
for (const j of jobs) {
  const job = {
    id: `${j.ats === 'tekjobs' ? 'tj' : j.ats.slice(0, 2)}:${j.key}:${1000 + jobs.indexOf(j)}`, source: j.ats, company: j.company, title: j.title,
    url: j.ats === 'tekjobs' ? `https://tekjobs.timurtek.com/jobs/example-${j.key}` : `https://jobs.example.com/${j.key}/${j.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    location: j.location, remote: j.remote, posted: iso(j.days), salary: `${money(j.salaryMin)}–${money(j.salaryMax)}`, salaryMin: j.salaryMin, salaryMax: j.salaryMax,
    department: j.department, descriptionText: j.text, descriptionHtml: `<p>${j.text}</p>`, companyKey: `${j.ats}:${j.key}`, tier: 'B',
  };
  const found = Math.max(0, j.days - (j.days > 2 ? 1 : 0));
  const scored = at(found, () => scoreJob(job, criteria));
  const file = at(found, () => writeJobNote(job, scored, criteria));
  ids[j.key] = path.basename(file, '.md');
}

// 4. Where the search stands: a few decisions, an application in flight, an interview, a pass, a closed listing.
const s = (key, status, daysAgo, reason) => at(daysAgo, () => store.setStatus(ids[key], status, 'app', reason));
s('meridian', 'reviewing', 19); s('meridian', 'applying', 17); s('meridian', 'applied', 12); s('meridian', 'interviewing', 5);
at(12, () => store.saveApplicationDraft(ids.meridian, { field: 'Narrative', value: 'Design engineer; the Acme system numbers lead (62 components, 12 teams, defects down a third).' }));
at(12, () => store.saveApplicationDraft(ids.meridian, { field: 'Resume variant', value: 'Design Engineer (Staff)' }));
at(12, () => store.saveApplicationDraft(ids.meridian, { field: 'Tailored summary', value: 'Design engineer with eight years on design systems; led the Acme Finance system from 4 to 62 components across 12 teams, including white-label theming for partner banks.' }));
at(12, () => store.saveApplicationDraft(ids.meridian, { field: 'Tailored bullets', value: 'System architecture and tokens · white-label theming · the ESM migration (1.9 MB to 640 kB) · the WCAG 2.1 AA audit with zero blockers' }));
at(12, () => store.saveApplicationDraft(ids.meridian, { field: 'Risks', value: 'No payroll domain experience; say so, and point at fintech at Acme.' }));
at(12, () => store.saveApplicationDraft(ids.meridian, { field: 'Applied on', value: day(12) }));
at(12, () => store.saveApplicationDraft(ids.meridian, { field: 'Follow-up due', value: day(5) }));
at(12, () => store.saveCoverLetter(ids.meridian, `Hello. Your posting says Meridian Pay's design system serves six product teams and the white-label theming your partners depend on. At Acme Finance I took the system from 4 components to 62, used by 12 teams, with partner theming built on the same tokens; UI defect reports fell by a third in the year after. The part I would bring first is the token pipeline, because a system that themes for partners lives or dies on it. In the first month I would inventory the two legacy apps against the system and write down what they still need, since that list is the migration plan. Jordan Example.`));
at(5, () => store.addNote(ids.meridian, 'Recruiter screen with Priya went well; technical interview with the platform lead scheduled for next week. She asked for the Storybook link.'));

s('northwind', 'reviewing', 2); s('northwind', 'applying', 1);
at(1, () => store.saveApplicationDraft(ids.northwind, { field: 'Narrative', value: 'Design engineer; lead with the audit-and-plan first quarter, which is exactly what the Acme migration was.' }));
at(1, () => store.saveApplicationDraft(ids.northwind, { field: 'Resume variant', value: 'Design Engineer (Staff)' }));

s('copperleaf', 'reviewing', 3);
s('fjord', 'reviewing', 7); s('fjord', 'applying', 6); s('fjord', 'applied', 4);
at(4, () => store.saveApplicationDraft(ids.fjord, { field: 'Applied on', value: day(4) }));
at(4, () => store.saveApplicationDraft(ids.fjord, { field: 'Follow-up due', value: day(-3) }));
s('quill', 'reviewing', 16); s('quill', 'passed', 15, 'wrong role shape');
s('signalfire', 'passed', 1, 'location or authorisation');
s('basalt', 'reviewing', 22); s('basalt', 'applying', 20); s('basalt', 'applied', 18); s('basalt', 'rejected', 6);
at(6, () => store.addNote(ids.basalt, 'Form rejection after twelve days. No reason given.'));

// Verdant's listing vanished from its board on a later scan: the note stays, marked closed.
{
  const f = path.join(P.jobs, `${ids.verdant}.md`);
  fs.writeFileSync(f, store.replaceFrontmatterLine(fs.readFileSync(f, 'utf8'), 'listing', `closed ${day(9)}`));
}

// 5. People: a recruiter on the interview thread, a hiring manager, a referral.
const priya = at(14, () => people.createPerson({ name: 'Priya Example', role: 'recruiter', company: 'Meridian Pay', email: 'priya@meridian.example.com', about: 'Technical recruiter for the platform org. Replies within a day.' }));
at(14, () => people.attachPerson(ids.meridian, priya.id, { role: 'recruiter', context: 'reached out after the application' }));
at(14, () => people.logContact(priya.id, { date: day(14), via: 'mail', text: 'Wrote back the day after the application: "Would love to set up a 30-minute intro."' }));
at(5, () => people.logContact(priya.id, { date: day(5), via: 'mail', text: 'Recruiter screen done; sending the platform lead my Storybook link.' }));
const sam = at(3, () => people.createPerson({ name: 'Sam Example', role: 'hiring-manager', company: 'Northwind Labs', email: '', links: 'https://www.linkedin.com/in/sam-example', about: 'Leads the platform team; wrote the posting.' }));
at(3, () => people.attachPerson(ids.northwind, sam.id, { role: 'hiring-manager', context: 'named in the posting' }));
const lee = at(6, () => people.createPerson({ name: 'Lee Example', role: 'referral', company: 'Fjord Analytics', email: 'lee@example.com', about: 'Former Widgets Inc colleague, now on Fjord\'s data team.' }));
at(6, () => people.attachPerson(ids.fjord, lee.id, { role: 'referral', context: 'submitted the internal referral' }));
at(6, () => people.logContact(lee.id, { date: day(6), via: 'app', text: 'Asked for a referral; Lee submitted it the same afternoon.' }));

// 6. Two scan logs and the dashboard, so Runs and Overview have something to show.
for (const [daysAgo, found, total, fresh] of [[7, 14, 24812, 9], [0, 14, 25340, 3]]) {
  at(daysAgo, () => appendLog([
    `## Run ${day(daysAgo)} 07:30 UTC`,
    `- Boards: 304/304 ok · postings scanned: ${total} · scored ≥ ${criteria.minScore}: ${found + 380} · **new: ${fresh}** · closed: ${daysAgo ? 0 : 1} · 88.4s`,
    `- Criteria: Search Criteria`,
    '- TekJobs postings: 1 postings', '- Himalayas: 400 postings', '- Jobicy: 205 postings',
  ]));
}
writeDashboard({ when: `${day(0)} 07:30 UTC`, companiesTotal: 304, companiesOk: 304, companiesFailed: 0, totalJobs: 25340, newMatches: 3 });

// 7. Nothing machine-specific leaves with the sample: the seen-state and health files belong to a real scan.
fs.rmSync(path.join(OUT, '.tekjobs'), { recursive: true, force: true });
fs.rmSync(HOME, { recursive: true, force: true });
write('README.md', `
# Sample profile folder

A complete, fictional TekJobs profile folder: Jordan Example, a design engineer in Portland, three weeks into a search. Fourteen postings at companies that do not exist, one application in interview, one rejected, two passed, one listing closed, three people on the threads, two scan logs and the dashboard. Every note was written by the product's own code (\`npm run sample\` rebuilds it), so it is always in the shape the app expects.

Look at it in the app without touching your own folder:

\`\`\`
TEKJOBS_PROFILE=$PWD/samples/vault npm run serve
\`\`\`

Then \`cd app && npm run dev\` and open the app. Nothing here is a real person, company or posting; every domain is example.com.
`);

const count = fs.readdirSync(P.jobs).filter((f) => f.endsWith('.md')).length;
console.log(`sample vault written to ${OUT}: ${count} job notes, ${fs.readdirSync(path.join(OUT, 'People')).length} people, ${fs.readdirSync(P.logs).length} logs`);
