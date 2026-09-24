---
title: Getting started
order: 1
summary: Install, import a resume, be interviewed, and let the morning task take it from there.
---

## What you need

- **Node 20 or newer.** One command installs TekJobs; the scan has one dependency (PDF reading).
- **A folder for your profile.** Plain markdown. Obsidian is the nicest way to read it, and not required.
- **An AI client that speaks MCP, signed in on this machine.** Claude Code by default; Codex, Cursor and Claude Desktop work the same way, and [Connect your AI client](/docs/ai-clients) has the exact lines for each. The interview and everything over MCP run there. The app's cover-letter and tailored-resume buttons run a CLI with the prompt as an argument; the default is Claude Code's `claude -p`, and another command goes in Settings. No separate model API key: TekJobs adds no per-call AI billing, and usage follows the client you already have.
- **Check mail needs Claude Code specifically**, with its Gmail connector enabled: the run allows three Gmail read tools by name and denies everything else, which is what makes it safe to run unattended. Optional; everything else works without it.
- Windows, macOS or Linux. The morning task is set up for each by `tekjobs schedule`. Git only if you clone to change the code.

Nothing personal lives in the repository. Your profile folder, criteria, watchlist, notes, mail state and `~/.tekjobs/config.json` are outside it.

## Install

```
npx @timurtekb/tekjobs init ~/Obsidian/JobSearch --resume ~/Downloads/resume.pdf
npm install -g @timurtekb/tekjobs
```

`init` creates the profile folder (the folder you name, or `~/.tekjobs/profile`), writes the starter notes, imports the resume, and remembers the folder in `~/.tekjobs/config.json`. The folder can be anywhere; inside an Obsidian vault is the nicest place. The global install gives the morning task a command that lasts; npx's cache does not.

From a clone, to change the code or run the app from source:

```
git clone https://github.com/Timurtek/tekjobs && cd tekjobs
npm install
npm run init -- --resume ~/Downloads/resume.pdf
```

## A look before you commit

The repository ships a fictional profile folder, `samples/vault`: a design engineer three weeks into a search, fourteen postings, an interview in progress, people on the threads, two scan logs. Point the API at it and the app shows a search in progress instead of an empty folder:

```
TEKJOBS_PROFILE=$PWD/samples/vault npm run serve
cd app && npm run dev
```

Nothing in it is real. `npm run sample` rebuilds it with today's dates.

## The interview

Connect the server to your client. For Claude Code that is one line; [the other clients](/docs/ai-clients) take the same command, `tekjobs mcp`:

```
claude mcp add tekjobs -- tekjobs mcp
```

Then say:

> Use the tekjobs MCP server. Call `onboarding_status`, then `onboarding_materials`, and follow its script: interview me, write my profile, set the criteria, run a dry scan, and show me the top matches.

The interview reads your resume, asks the few things a resume cannot say (target titles, seniority, work mode, pay floor, hard exclusions, links), writes `Profile/Profile.md` and the criteria, and runs the first scan. LinkedIn: give it your data export, not a URL; it will not scrape profile pages. From a clone, `app/.mcp.json` connects the server for Claude Code on its own when it is opened in `app/`.

## The app

```
tekjobs serve        # the app and its API on http://127.0.0.1:8787
```

From a clone, `cd app && npm install`, then `npm run server` (API on 8787) and `npm run dev` (UI on 5173) side by side, or `npm run start` to build the UI and serve it from the API on one port.

## The mornings

The scan should run every morning without you. `tekjobs schedule` sets that up: on Windows it creates the Task Scheduler entry (daily at 07:30, `--time` to change it) that runs `run.cmd`; on macOS and Linux it prints the crontab line, and on macOS a launchd agent too, that runs `run.sh`. Both do the scan and then the read-only mail pass, so by the time you open Today the matches are filed and the mailbox has been read. `--print` shows the command without installing anything. From a clone the scan is `npm run scan` at the repository root.

## How long it takes

About twenty-five minutes end to end on a fresh machine: five for the install, ten for the interview (it asks its questions in one message and writes the notes itself), five for the first dry scan to fetch three hundred boards, five to look at the top matches and adjust a title term or the pay floor. After that the mornings are the scan's; yours start at Today.
