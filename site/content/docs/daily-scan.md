---
title: The daily scan
order: 4
summary: Hundreds of boards, tens of thousands of postings, a minute, no keys.
---

## Sources

Company boards on Greenhouse, Lever, Ashby, Workday, Rippling, SmartRecruiters, Workable, BambooHR, Breezy, Personio, Teamtailor and Eightfold; the Atlassian, GitHub, Spotify and Amazon career APIs; the Google and Apple career pages (keyword-searched; they have no API); and a dozen aggregator feeds including Wellfound's and Built In's remote listing pages. All public, all key-free. Two optional feeds need a free key: Adzuna, which reaches listings that never make it to a company board, and USAJOBS, every federal posting in the United States.

Job alert emails saved into `Inbox/` are read too, which is how LinkedIn and Indeed listings get in without anything contacting those sites.

Some sites are not reachable from a scan and the docs say so rather than pretend: Microsoft's careers API fails TLS with a certificate-name mismatch and its new site refuses unauthenticated reads; Meta's search is client-rendered. For those, paste the job page you find; the page importer reads it.

## The watchlist

`Targets/Companies.md` is a markdown table: company, platform, slug, tier, last fetch, notes. The Companies page shows it with the last fetch status and lets you add a board; `add_company` does the same over MCP. The registry a new profile starts with is in the repository at `src/starter/companies-table.md`, and pull requests to it are the most useful contribution.

## A run

`npm run scan` at the repository root. Around 25,000 postings fetched, deduplicated across sources on company and title, scored, and the ones that clear the bar written as notes. Listings that vanished from a board that fetched successfully are marked closed. A log note lands in `Logs/`, the dashboard `_Home.md` is regenerated, and the Runs page shows the history with a run button and a preset picker.

Flags: `--dry` scores without writing, `--only <slug>` fetches one board, `--check-slugs` reports boards that answer with nothing, `--criteria <name|file>` scores this run with a preset.
