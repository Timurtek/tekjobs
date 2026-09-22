# TekJobs

A local-first job-search machine. It watches hundreds of company job boards every day, scores every posting against a profile you own, and files the matches as markdown notes in a folder on your machine. The LLM is whichever one you already pay for, connected through MCP. No accounts, no API keys, nothing leaves your computer.

Working name. Built by one person for his own search first; the venture and the product come after.

## Requirements

- **Node 20 or newer.** The scraper has one dependency (PDF reading); the app has its own `npm install`.
- **A folder for your profile.** Plain markdown. Obsidian is the nicest way to read it, and not required.
- **An LLM that can write code and run tools, signed in on this machine.** Claude Code (`claude`) by default. Everything that drafts text goes through it (the onboarding interview, cover letters, tailored resumes), so there is no API key and nothing metered. Another CLI can be set under `"llm"` in `~/.tekjobs/config.json`.
- **For "Check mail": a Gmail connector attached to that CLI** (Claude's Gmail connector). The run is boxed to Gmail's three read tools; nothing can send, label or delete.
- Optional: free Adzuna and USAJOBS keys for those two feeds, and `"contact"` in `~/.tekjobs/config.json` so the user agent on scan requests names a way to reach you.

Nothing personal lives in this repository. Your profile folder (profile, resume, criteria, watchlist, job notes, logs, mail state) and `~/.tekjobs/config.json` are outside it; the repository is the code and the starter notes a new profile folder begins with.

## What you get

- **A profile folder** (default `~/.tekjobs/profile`): your profile, your resume as text, the scoring criteria, the board watchlist, one note per matched job, and scan logs. Plain markdown, readable in Obsidian or anything else.
- **A daily scan** over Greenhouse, Lever, Ashby, Workday, Rippling, SmartRecruiters, Workable, BambooHR, Breezy, Personio, Teamtailor and Eightfold boards, the Atlassian, GitHub, Spotify and Amazon career APIs, the Google and Apple career pages (keyword-searched; they have no API), and eleven aggregator feeds including Wellfound's and Built In's remote listing pages. All public, all key-free. Two optional feeds need a free key: Adzuna, which reaches listings that never make it to a company board, and USAJOBS, which is every federal posting in the United States. Job alert emails saved into `Inbox/` are read too, which is how LinkedIn and Indeed listings get in without anything contacting those sites. Around 25,000 postings a run, deduplicated, scored, and cut to the ones that fit you.
- **An app** (Zengin UI): overview, filterable jobs table with a detail sheet, drag-and-drop pipeline, watchlist, criteria editor, scan history with a run button, and the agent setup page.
- **An MCP server** with 39 tools, so Claude Code, Claude Desktop, ChatGPT or Cursor can run the whole search: onboard you, find matches, move them through the pipeline, pull your profile and a posting together to tailor an application, save the draft into the note, add boards, start scans.

## Getting started

```
git clone <this repo> tekjobs && cd tekjobs
npm install                                   # one dependency, for reading PDF resumes
npm run init -- --resume ~/Downloads/resume.pdf   # creates the profile folder and imports the resume
```

Then the interview. Open Claude Code in the `app/` folder (its `.mcp.json` connects the `tekjobs` server) and say:

> Use the tekjobs MCP server. Call onboarding_status, then onboarding_materials, and follow its script: interview me, write my profile, set the criteria, run a dry scan, and show me the top matches.

Any MCP client works the same way: `node app/server/mcp.mjs` on stdio. The interview reads your resume, asks the few things a resume cannot say (target titles, seniority, work mode, pay floor, hard exclusions, links), writes `Profile/Profile.md` and the criteria, and runs the first scan. LinkedIn: give it your LinkedIn data export, not a URL; it will not scrape profile pages.

Then the app:

```
cd app && npm install
npm run server      # API on http://127.0.0.1:8787
npm run dev         # UI on http://localhost:5173
```

`npm run start` in `app/` builds the UI and serves it from the API on one port. The scan itself is `npm run scan` at the root; schedule it with your OS (a Windows Task Scheduler entry and `run.cmd` are included; launchd and cron equivalents are one line).

## Cover letters

Each job has a Cover letter tab. "Write cover letter" runs a local LLM CLI you are already signed in to (Claude Code by default; set another under `"llm"` in `~/.tekjobs/config.json`), so there is no API key and nothing metered. It writes from the live posting and your resume, and your resume is the only source of facts. How it sounds comes from `Profile/Voice.md` in your profile folder: your voice rules, the shape of a letter you would send, the patterns you never use, and samples of your own prose. Edit that note to change every letter after it; there is a generic fallback for a profile without one. The prompt makes the model draft and then edit against the same checklist (portability test, repeated shapes, self-adjectives, quote count). The result is saved under `## Cover letter` in the job note and checked: a figure that is not on your resume, your profile or the posting is flagged, along with dashes, placeholders, stock phrases, a letter that never names the company, and the tells of a generated letter: a "decade" opener, "You ask for X" stanzas, tag lines, "not X but Y" contrasts, colon reveals, applicant boilerplate, adjectives about yourself. An agent connected over MCP can do the same with `cover_letter_materials` and `save_cover_letter`. If the CLI is signed out or out of date the tab says so and what to run.

## Tailored resumes

Each job also has a Resume tab. "Tailor my resume to this posting" produces a version of your resume of record with the summary rewritten for the posting and the bullets, capabilities and products reordered and pruned to what it asks for. It may not add anything: the check traces every bullet back to a line of your real resume and flags any bullet, figure, date range or job header that is not there. The result is saved under `## Tailored resume` in the job note (headings nested, restored on read) and the print view at `/api/jobs/<id>/resume.html` is where the PDF you upload comes from: print, save as PDF, margins and page size are set. Over MCP: `tailored_resume_materials` and `save_tailored_resume`.

## Adding a job you found yourself

The scan watches boards. For the posting you saw on LinkedIn, in a newsletter, or in a friend's message, paste the link: the "Add by link" button in the Jobs view, `tekjobs add <url> [<url>...]` on the command line, or the `add_job` MCP tool. Each link is read once, turned into the same job shape the scan produces, scored with your criteria, and written as a note unless the scan already has it, a note already points at that link, or an existing note has the same company and title. A Greenhouse, Lever or Ashby link is read through the board's API, so the note is as full as a scanned one; a company careers page is read through its JSON-LD posting data when it has some, and its title and text when it does not. A LinkedIn job link is opened once as a signed-out visitor, the way a browser would open it, and when the posting names the company's own apply page on one of those boards, that page is imported instead and the LinkedIn link is kept as where it was seen. Nothing searches or crawls: one link in, one request or two out. Indeed blocks signed-out reads; paste the company's own link instead.

## What the mailbox says

Applications come back as email: a confirmation, a rejection, an interview request. "Check mail" on Today reads those through the same local CLI that writes the letters, using the Gmail connector already attached to it, and with the run boxed: only the Gmail read tools are allowed and every write tool is denied by name, so a run can read and nothing else. The model only extracts (company, role, kind, date, one-line gist, message id); matching each email to a note and everything that changes a note is ordinary code, and nothing changes until you confirm an item. A confirmation on a note you had not marked applied marks it applied as of the mail's date; a rejection marks it rejected; an interview request marks it interviewing; an email about a job with no note offers to create one. Every confirmed item writes a dated line with the gist and a link to the message into the note, and fills the packet's Applied on when it is empty, which is what makes the response numbers on Overview real. Also `tekjobs mail [--days N]`, and `mail_check` / `mail_items` over MCP (read and start only; confirming is yours). The daily task runs the read right after the morning scan (`run.cmd`), and the envelope in the top bar shows how many email groups wait on you from any page, with a Check now for between-times.

## People

The recruiters, hiring managers, interviewers and referrals a search meets: one note each under `People/` (role, company, email, links, a line of context, the job notes they are on, a dated log of contacts), and a `## People` section on each job note naming who is on that thread. Most arrive from the mail check: when the email a person confirms was written by a human rather than a no-reply address, that human is added, put on the note, and gets the email on their log. The rest are added on the People page or from a job sheet's People tab. Nothing is enriched or looked up anywhere; the record is who actually wrote to you and who you actually met. Over MCP: `list_people`, `get_person`, `add_person`, `attach_person`, `log_contact`.

## The copy panel

Application forms ask for the same dozen things. The clipboard icon in the top bar opens a panel of one-click snippets: name, email, phone, location, links, availability, the salary answer, and anything you add (a work-authorization line, a standard "why this role" opener, a multi-line blurb). Type a few letters and Enter copies the first match. The list is yours: Customize edits labels, groups, values and order, and it is stored in `Profile/Snippets.md` as a json block, so Obsidian can edit it too. Until you save once, the panel offers a set read from your profile's Basics. Over MCP, `list_snippets` gives an agent the same answers verbatim.

## Applying

TekJobs never submits an application. The agent tailors the resume and cover letter from the note, prefills what it can, and stops. You review and click. Every field it drafts is written into the job note so the record survives.

## How scoring works

Everything is in the criteria JSON block in `Targets/Search Criteria.md`, which the interview writes and you can edit: title terms (weighted), hard exclusions, description keywords, seniority, remote rule, a pay floor with a stretch band beneath it, recency, and which aggregator feeds are on. A posting needs `minScore` to become a note. Notes are never rewritten once they exist; only their `listing:` line flips to closed when a posting disappears. Your `status:` edits are the record.

The app's **Criteria** page edits the same JSON as fields (bar, penalties, title and description terms, seniority words, location and pay rules, recency, source toggles) with the raw JSON one tab over; keys the form does not know about are kept. **Presets** are named criteria sets under `Targets/Criteria/`: save the current form as one, load one to edit it, make one the active set, or run a single scan with it without touching the daily scan (`tekjobs scan --criteria "<name>"`, the Score with picker on Runs, or `run_scan` with `criteria` over MCP). Every run logs which set it scored with, and every note carries that set's weights fingerprint. After a criteria change, `tekjobs rescore --full --dry` shows what the existing notes would score under the new rules (rebuilt from each note, recency judged at the day it was found, description points kept where the note holds only part of the posting) and `--full` without `--dry` applies it: score, pay band, the match reasons, and a status-log line on every note that moved.

The **Profile** page edits the notes applications are written from: `Profile/Profile.md` (who you are), `Positioning.md` (how the story is told), `Voice.md` (how you write); the resume note is shown read-only because `tekjobs resume sync` replaces it.

## Commands

```
node cli.mjs init [dir] [--resume <file>]   create (or adopt) a profile folder and remember it
node cli.mjs resume <file>                  import or replace the resume (PDF, DOCX, Markdown, text)
node cli.mjs status                         what the onboarding still needs
node cli.mjs scan [--dry] [--min N] [--floor N] [--only <slug>] [--criteria <preset name | file>]
node cli.mjs add <url> [<url>...] [--dry]  add postings you found yourself
node cli.mjs serve                          the app + API
node cli.mjs mcp                            the MCP server on stdio
```

The profile folder is resolved from `TEKJOBS_PROFILE`, then `~/.tekjobs/config.json`, then `~/.tekjobs/profile`.

## Layout

```
cli.mjs                 tekjobs command
run.mjs                 the scan
src/config.mjs          profile folder resolution, the two config notes
src/profile.mjs         init, resume import, onboarding status, interview materials, save profile, fetch link
src/resume.mjs          PDF / DOCX / Markdown text extraction
src/sources.mjs         Greenhouse, Lever, Ashby, Workday, RemoteOK, HN
src/sources-extra.mjs   the other platforms, career APIs, aggregators
src/score.mjs           scoring and pay-range parsing
src/vault.mjs           job notes, dedupe state, closed detection, log, dashboard
src/starter/            the notes a new profile folder starts with (including the board registry)
app/                    Zengin UI front end, API server, MCP server
tools/                  board and source discovery scripts
```

## Releases

Versions come from the commit messages, by [semantic-release](https://semantic-release.gitbook.io/) on every push to `main` (`.github/workflows/release.yml`): tests, the app's type check and `zengin check` run first; then `feat:` commits make a minor release and `fix:` and `perf:` a patch. The project is at 0.x on purpose, so a `BREAKING CHANGE:` footer or a `!` after the type also bumps the minor (the `releaseRules` line in `.releaserc.json`); delete that line when 1.0 is earned and breaking changes become majors. The release bumps `package.json`, writes `CHANGELOG.md`, tags `vX.Y.Z` and publishes the notes on GitHub. Nothing is published to npm. Commit messages are checked locally by commitlint through a husky hook (`npm install` at the root sets it up), in the [Conventional Commits](https://www.conventionalcommits.org/) shape: `type(scope): summary`, scope optional, and a prose body is welcome. The app's sidebar footer shows the running version.

## Contributing data

The two things that compound are data files: the board registry (`src/starter/companies-table.md`, platform + slug per company) and, soon, criteria presets per role. Pull requests to either are the most useful contribution.
