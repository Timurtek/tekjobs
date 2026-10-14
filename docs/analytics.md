# How TekJobs is measured

TekJobs promises "There is no telemetry" (README, the site's landing page, the privacy policy). So the software
itself sends nothing, and it never will without Tek changing that promise in public first. Everything below is
counted somewhere else: on the marketing site, on GitHub, and in Tek's own job pipeline.

`test/repo-traffic.test.mjs` keeps the promise honest: it fails if the CLI, the scraper or the app (server or
UI) depends on or names an analytics service, or if the README stops saying "There is no telemetry."

## The one number

**Interviews per month from matches TekJobs found.** This is the venture's goal (`found_interviews`).

**Target: 2 interviews per month** (Tek's venture goal in ORG Brain, as of 2026-10-13). The goal is the source:
if Tek changes it there, change it here.

How to read it, from Tek's pipeline (the job notes in his TekJobs vault, `Jobs/`):

- A note counts when its `## Status log` has a line `→ **interviewing**` dated in the month, **and** its first
  status-log line says `found by scraper`. Equivalently, its frontmatter has no `added_by:` field
  (`scraper/vault.mjs` writes one for notes added from a link, an application email or the LinkedIn export). That
  means TekJobs found the job on a board, not that Tek added it by hand or imported it from LinkedIn.
- Each note counts at most once a month, however many rounds it has.
- The Pipeline page in the app shows the same notes under Interviewing. The count is read from the notes, so it
  does not depend on the app running.

Telemetry does not feed this number. It comes from files Tek owns.

## The marketing site: Google Analytics 4

`site/` (tekjobs.timurtek.com) runs GA4 on production deployments only (`site/src/lib/flags.ts`,
`site/src/components/GoogleTag.tsx`). The privacy policy already names Google Analytics and its cookies.

| what | where it comes from | what it proves |
| --- | --- | --- |
| `page_view` | GA4 enhanced measurement, client-side navigations included | people reach the site, and which pages they read (landing, docs, job posting) |
| `session_start`, `first_visit` | GA4 automatic events | new versus returning visitors |
| `scroll`, `click` (outbound) | GA4 enhanced measurement | outbound clicks to GitHub and npm, the step before an install |

Read it in GA4: property for measurement id `G-DX8B8DCTGF`, Reports → Engagement → Pages and screens, and
Acquisition → Traffic acquisition for where visitors came from. Preview and local builds send nothing.

Proof that it fires: `docs/evidence/ga4-page-view-tekjobs.json` and its screenshot
`docs/evidence/ga4-page-view-tekjobs.png`. On 2026-10-14 a fresh Chromium loaded https://tekjobs.timurtek.com/
(200), the page loaded `gtag/js?id=G-DX8B8DCTGF`, and it sent one hit to `www.google-analytics.com/g/collect` with
`tid=G-DX8B8DCTGF` and `en=page_view`. The hit was intercepted and answered locally, so the check itself was not
counted. This proves the site sends the event; seeing it arrive needs access to the GA4 property (Realtime report).

There is no custom sign-in or purchase event. Adding one changes the site, and this packet leaves the site as it
is (Tek, 2026-10-13).

## The repo: `npm run traffic`

`tools/repo-traffic.mjs` reads the four GitHub counters Tek named (2026-10-13) and prints them as a vault note,
with frontmatter that ORG Brain can read and a table for a person. `--json` prints JSON instead. It only prints;
to keep a copy, redirect the output where you want it.

```
npm run traffic
npm run traffic -- --json
GITHUB_TOKEN=<token with push access> npm run traffic   # adds clones
```

| counter | source | what it proves |
| --- | --- | --- |
| `stars` | GitHub repo | people found the repo and wanted to keep it |
| `forks` | GitHub repo | people took a copy to run or change |
| `releases`, `release_downloads` | GitHub releases, every page | releases shipped; asset downloads (TekJobs ships through npm, so this is expected to stay near 0) |
| `clones_14d` (and `clones_14d_unique`) | GitHub traffic API, last 14 days; **needs `GITHUB_TOKEN`** | people cloned the repo: the north star's "a stranger clones it" |

Without `GITHUB_TOKEN`, clones are reported as `null` with a line saying why, and everything else is still read.
The token is only sent to GitHub's traffic endpoint. GitHub keeps traffic for 14 days only, so a weekly run is
what keeps a history. Every answer from GitHub is checked before it is counted: a missing or malformed field fails
the run with the endpoint and the field, rather than printing a wrong number.

## Privacy

- The software sends nothing, so it has no events to carry personal data.
- GA4 on the site holds a random id per browser, as the privacy policy says. No names, emails or free text go
  into it.
- The repo counters are aggregate counts. The one number is read from Tek's own notes and leaves his
  machine only as a count.
