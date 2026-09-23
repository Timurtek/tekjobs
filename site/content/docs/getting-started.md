---
title: Getting started
order: 1
summary: Clone, import a resume, be interviewed, and let the morning task take it from there.
---

## What you need

- **Node 20 or newer.** The scraper has one dependency (PDF reading); the app has its own `npm install`.
- **A folder for your profile.** Plain markdown. Obsidian is the nicest way to read it, and not required.
- **A coding CLI that can run tools, signed in on this machine.** Claude Code by default. The onboarding interview, cover letters, tailored resumes and the mail check all go through it, so there is no API key and nothing metered. Another CLI can be set in Settings.
- **Its Gmail connector**, if you want Check mail. The run is boxed to Gmail's three read tools.

Nothing personal lives in the repository. Your profile folder, criteria, watchlist, notes, mail state and `~/.tekjobs/config.json` are outside it.

## Install

```
git clone https://github.com/Timurtek/tekjobs && cd tekjobs
npm install
npm run init -- --resume ~/Downloads/resume.pdf
```

`init` creates the profile folder (default `~/.tekjobs/profile`, or the folder you name), writes the starter notes, imports the resume, and remembers the folder in `~/.tekjobs/config.json`.

## The interview

Open Claude Code in the `app/` folder. Its `.mcp.json` connects the `tekjobs` server. Say:

> Use the tekjobs MCP server. Call onboarding_status, then onboarding_materials, and follow its script: interview me, write my profile, set the criteria, run a dry scan, and show me the top matches.

Any MCP client works the same way: `node app/server/mcp.mjs` on stdio. The interview reads your resume, asks the few things a resume cannot say (target titles, seniority, work mode, pay floor, hard exclusions, links), writes `Profile/Profile.md` and the criteria, and runs the first scan. LinkedIn: give it your data export, not a URL; it will not scrape profile pages.

## The app

```
cd app && npm install
npm run server      # API on http://127.0.0.1:8787
npm run dev         # UI on http://localhost:5173
```

`npm run start` in `app/` builds the UI and serves it from the API on one port.

## The mornings

The scan is `npm run scan` at the repository root; schedule it with your OS. A Windows Task Scheduler entry and `run.cmd` are included; launchd and cron equivalents are one line. `run.cmd` runs the scan and then the mail read, so by the time you open Today the matches are filed and the mailbox has been read.
