# How TekJobs is measured

TekJobs promises "There is no telemetry" (README, the site's landing page, the privacy policy). So the software
itself sends nothing, and it never will without Tek changing that promise in public first. Everything below is
counted somewhere else: on the marketing site, on GitHub and on npm, and in Tek's own job pipeline.

`test/repo-traffic.test.mjs` keeps the promise honest: it fails if the CLI, the scraper or the app (server or
UI) depends on or names an analytics service, or if the README stops saying "There is no telemetry."

## The one number

**Interviews per month from matches TekJobs found.** This is the venture's goal (`found_interviews`). Its target
is Tek's and lives in the venture's goals in ORG Brain, not here.

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

There is no custom sign-in or purchase event. Adding one changes the site, and this packet leaves the site as it
is (Tek, 2026-10-13).

## The repo and the package: `npm run traffic`

`tools/repo-traffic.mjs` reads public counters and prints them as a vault note, with frontmatter that ORG Brain
can read and a table for a person. `--json` prints JSON instead. `--out <file>` also writes the output to a file.

```
npm run traffic
npm run traffic -- --out "D:/path/to/vault/Metrics/TekJobs repo traffic.md"
GITHUB_TOKEN=<token with push access> npm run traffic   # adds clones and views
```

| counter | source | what it proves |
| --- | --- | --- |
| `stars` | GitHub repo | people found the repo and wanted to keep it |
| `forks` | GitHub repo | people took a copy to run or change |
| `watchers` | GitHub repo | people want to hear about changes |
| `releases`, `release_downloads` | GitHub releases, every page | releases shipped; asset downloads (TekJobs ships through npm, so this is expected to stay near 0) |
| `clones_14d`, `views_14d` (and `_unique`) | GitHub traffic API, last 14 days; **needs `GITHUB_TOKEN`** | people cloned or browsed the repo: the north star's "a stranger clones it" |
| `npm_downloads_week`, `npm_downloads_month` | api.npmjs.org | installs of `@timurtekb/tekjobs`. This counts downloads, not people: CI, mirrors and bots are in it too, so read the trend, not the absolute number |

Without `GITHUB_TOKEN`, clones and views are reported as `null` with a line saying why, and everything else is
still read. The token is only sent to GitHub's traffic endpoints. GitHub keeps traffic for 14 days only, so a
weekly run is what keeps a history.

## Privacy

- The software sends nothing, so it has no events to carry personal data.
- GA4 on the site holds a random id per browser, as the privacy policy says. No names, emails or free text go
  into it.
- The repo and npm counters are aggregate counts. The one number is read from Tek's own notes and leaves his
  machine only as a count.
