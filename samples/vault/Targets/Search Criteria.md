---
type: config
updated: 2026-09-03
---
# Search Criteria

> **The scraper reads the JSON block below.** The onboarding interview fills it from your resume and your answers; after that, edit it here. Weights are additive points. A job needs `minScore` to get its own note in `Jobs/`.

How scoring works:
- **titleTerms** — best single match in the job title counts fully, each extra match adds 5. Empty until the interview runs.
- **titleExclude** — any hit in the title drops the job entirely.
- **noTitleMatchPenalty** — a posting whose title matches nothing in `titleTerms` takes this hit, so location and recency alone can't carry it over the bar.
- **descTerms** — each term found in the description adds its weight (capped at `descCap`).
- **seniority** — senior/staff/lead/principal adds; junior/intern subtracts.
- **location** — remote adds; with `requireRemote` on, anything not remote takes `notRemotePenalty` and drops out. Clearly non-US-only listings subtract heavily.
- **salary** — a stated range at or above `minAnnual` adds; between `stretchAnnual` and `minAnnual` is the stretch band (small penalty, kept visible); below subtracts. No stated range is neutral.
- **recency** — posted within 7 days adds, over 90 days subtracts.
- **openSources** — aggregator feeds that need no company slug. Set one to `false` to drop it. `wellfound` and `builtin` read those sites' remote listing pages (no API), searched by design-engineering roles; both lose to the same job from its ATS when both turn up.
- **email** — job alert emails you save into the `Inbox` folder of this profile, as `.eml`. This is how the boards with no public API get in: LinkedIn, Indeed, Otta and Wellfound all send alerts, and an email in your own mailbox is your own data. Nothing contacts those sites — it reads files you put there, and the links are for you to open. Links to Greenhouse, Lever, Ashby and Workday are picked up from any sender. Rows are thin (a title, a company, usually a location), so they score below the same job from an ATS and lose to it when both turn up.
- **adzuna** — the one source that needs a key. Set `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` in the environment (free at developer.adzuna.com), turn `openSources.adzuna` on, and it searches your top `titleTerms` in each country under `adzuna.countries`. It reaches listings that never appear on a company ATS board, but its descriptions come back as snippets, so those rows score lower than the same job fetched from its ATS.
- **usajobs** — every US federal posting. Set `USAJOBS_API_KEY` and `USAJOBS_EMAIL` (free at developer.usajobs.gov; the email is the one the key is registered to) and turn `openSources.usajobs` on. Unlike Adzuna it returns the whole description, so these rows score on equal footing, and it carries a real application deadline.

```json
{
  "minScore": 45,
  "descCap": 35,
  "noTitleMatchPenalty": -40,
  "titleExtraPer": 5,
  "titleExtraCap": 10,
  "titleTerms": {
    "design engineer": 40,
    "design systems": 30,
    "design system": 30,
    "ux engineer": 25,
    "frontend engineer": 15,
    "front end engineer": 15,
    "front-end engineer": 15,
    "platform engineer": 10
  },
  "titleExclude": [
    "intern",
    "internship",
    "apprentice",
    "new grad",
    "recruit",
    "account executive",
    "customer success",
    "manufacturing",
    "process engineer",
    "chemical",
    "biomedical",
    "automotive",
    "aerospace"
  ],
  "descTerms": {
    "design system": 6,
    "design systems": 6,
    "react": 4,
    "typescript": 4,
    "storybook": 4,
    "figma": 3,
    "accessibility": 4,
    "tokens": 3,
    "component library": 4,
    "wcag": 3
  },
  "seniority": {
    "boost": {
      "senior": 8,
      "staff": 10,
      "lead": 10,
      "principal": 10,
      "head of": 8,
      "founding": 8
    },
    "penalty": {
      "junior": -30,
      "intern": -50,
      "entry": -25,
      "associate": -15,
      "new grad": -40
    }
  },
  "salary": {
    "minAnnual": 200000,
    "stretchAnnual": 170000,
    "meetsBonus": 10,
    "abovePer10k": 1,
    "aboveCap": 8,
    "stretchPenalty": -8,
    "belowPenalty": -30
  },
  "location": {
    "requireRemote": true,
    "notRemotePenalty": -60,
    "remoteBoost": 15,
    "bayAreaBoost": 0,
    "bayAreaTerms": [],
    "usTerms": [
      "united states",
      "usa",
      "u.s.",
      "us-",
      "us ",
      "(us)",
      "us)",
      "north america",
      "americas",
      "remote - us",
      "remote us",
      "us remote",
      "anywhere"
    ],
    "nonUsTerms": [
      "london",
      "berlin",
      "paris",
      "amsterdam",
      "dublin",
      "europe",
      "emea",
      "uk",
      "united kingdom",
      "germany",
      "france",
      "netherlands",
      "spain",
      "portugal",
      "poland",
      "india",
      "bangalore",
      "bengaluru",
      "hyderabad",
      "singapore",
      "sydney",
      "melbourne",
      "australia",
      "toronto",
      "vancouver",
      "canada",
      "brazil",
      "são paulo",
      "sao paulo",
      "mexico city",
      "latam",
      "apac",
      "tokyo",
      "japan",
      "israel",
      "tel aviv",
      "stockholm",
      "copenhagen",
      "zurich",
      "lisbon",
      "warsaw",
      "prague",
      "tallinn",
      "riga",
      "riyadh",
      "saudi arabia",
      "dubai",
      "abu dhabi",
      "uae",
      "united arab emirates",
      "middle east",
      "korea",
      "seoul",
      "china",
      "shanghai",
      "beijing",
      "hong kong",
      "taiwan",
      "philippines",
      "vietnam",
      "indonesia",
      "nigeria",
      "south africa",
      "argentina",
      "colombia",
      "chile",
      "ottawa",
      "montreal",
      "waterloo"
    ],
    "nonUsPenalty": -45
  },
  "recency": {
    "days2": 25,
    "days7": 15,
    "days30": 5,
    "days90": -5,
    "older": -25
  },
  "openSources": {
    "remoteok": true,
    "hn": true,
    "email": true,
    "adzuna": false,
    "usajobs": false,
    "themuse": true,
    "remotive": false,
    "himalayas": true,
    "jobicy": true,
    "workingnomads": true,
    "arbeitnow": false,
    "wwr": true,
    "wellfound": true,
    "builtin": true
  },
  "adzuna": {
    "_note": "Needs ADZUNA_APP_ID and ADZUNA_APP_KEY in the environment (free at developer.adzuna.com), and openSources.adzuna set to true. Searches for your top titleTerms unless queries is set. Descriptions come back as snippets, so these rows score lower than the same job from its ATS.",
    "countries": [
      "us"
    ],
    "queries": [],
    "maxQueries": 6,
    "pages": 2,
    "maxDaysOld": 30
  },
  "email": {
    "_note": "Job alert emails you save into the Inbox folder of your profile, as .eml. Nothing contacts the sites; this reads files you put there. Understands LinkedIn, Indeed, Otta and Wellfound alerts, and picks up Greenhouse/Lever/Ashby/Workday links in anything else. Rows are thin — a title, a company, usually a location — so they score below the same job from an ATS.",
    "maxFiles": 200
  },
  "usajobs": {
    "_note": "Needs USAJOBS_API_KEY and USAJOBS_EMAIL in the environment (free at developer.usajobs.gov; the email is the one the key is registered to), and openSources.usajobs set to true. Every US federal posting, with full descriptions and a real application deadline. Searches your top titleTerms as position titles unless searchBy is \"keyword\" or queries is set.",
    "queries": [],
    "maxQueries": 6,
    "pages": 2,
    "datePosted": 30,
    "searchBy": "title"
  },
  "maxDescriptionChars": 6000
}
```
