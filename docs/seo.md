# Search and discovery (the site)

What a search engine or an AI assistant finds on tekjobs.timurtek.com, and the numbers that say so. TJOB-SEO-001.

## How it is measured

The site built and served the way Vercel runs it, from `site/` (`next build`, `next start -p 3917`), then:

- **Lighthouse 12.8.2** on the home page, mobile (the default) and desktop (`--preset=desktop`), headless Chrome,
  categories SEO, accessibility, performance, best practices.
- **What a crawler reads** on each page: the HTTP status, `<title>`, meta description, canonical link, robots meta,
  `og:url`, and the `@type` of each JSON-LD block. Firebase is not configured locally, so `/jobs` lists nothing and
  a job page is a 404; the job page's metadata is covered by its source and the tests instead.

## Baseline, before any change (2026-10-15, commit f6df201)

Lighthouse, home page:

| form factor | SEO | accessibility | performance | best practices |
|---|---|---|---|---|
| mobile | 100 | 100 | 72 | 100 |
| desktop | 100 | 100 | 92 | 100 |

No SEO or accessibility audit failed. Lighthouse's SEO category does not check for a sitemap, a canonical URL or
structured data, so 100 here did not mean findable. What a crawler read:

| page | status | canonical | robots meta | og:url | JSON-LD |
|---|---|---|---|---|---|
| `/robots.txt` | **404** | | | | |
| `/sitemap.xml` | **404** | | | | |
| `/` | 200 | none | none | none | none |
| `/jobs` | 200 | none | none | none | none |
| `/post-a-job` | 200 (description: the site default) | none | none | none | none |
| `/docs/getting-started` | 200 | none | none | none | none |
| `/legal/terms` | 200 | none | none | none | none |
| `/login` | 200 | none | **none: indexable** | none | none |
| `/account`, `/app/post-a-job` | 307 to `/login` | none | none | none | none |

Every page's `og:title` was "TekJobs", whatever the page, because the layout's Open Graph block was the only one.

## After (2026-10-15, branch orgbrain/tjob-seo-001)

Lighthouse, home page, same build method and the same Lighthouse:

| form factor | SEO | accessibility | performance | best practices |
|---|---|---|---|---|
| mobile | 100 | 100 | 72 | 100 |
| desktop | 100 | 100 | 92 | 100 |
| mobile, `/docs/getting-started` | 100 | 100 | not run | not run |

No SEO or accessibility audit failed. The scores did not move because they were already at the top; the change is in
what Lighthouse does not score. What a crawler reads now:

| page | status | canonical | robots meta | og:url | JSON-LD |
|---|---|---|---|---|---|
| `/robots.txt` | **200** | | | | |
| `/sitemap.xml` | **200**, 22 URLs | | | | |
| `/` | 200, title "TekJobs: a job search that remembers who you are" | `/` | none | `/` | Organization + WebSite + SoftwareApplication |
| `/jobs` | 200 | `/jobs` | none | `/jobs` | none |
| `/post-a-job` | 200, its own description | `/post-a-job` | none | `/post-a-job` | none |
| `/docs/<slug>` (16 pages) | 200 | `/docs/<slug>` | none | `/docs/<slug>` | TechArticle |
| `/legal/<slug>` (3 pages) | 200 | `/legal/<slug>` | none | `/legal/<slug>` | none |
| `/jobs/<id>` (live postings) | 200 | `/jobs/<id>` | none | `/jobs/<id>` | JobPosting (as before, now escaped) |
| `/login` | 200 | none | **noindex, nofollow** | none | none |
| `/account`, `/app/post-a-job/*` | 307 to `/login` | none | **noindex, nofollow** | none | none |

Canonicals and `og:url` are written absolute against `NEXT_PUBLIC_APP_URL` (default `https://tekjobs.timurtek.com`).

`robots.txt`:

```
User-Agent: *
Allow: /
Disallow: /api/
Disallow: /app/

Host: tekjobs.timurtek.com
Sitemap: https://tekjobs.timurtek.com/sitemap.xml
```

The sitemap lists the home page, `/jobs`, `/post-a-job`, every doc, every legal page (with its `updated` date as
`lastmod`), and every live job. It is rebuilt at most hourly, and without Firebase it still lists everything but jobs.
`/docs` and `/legal` are left out because they redirect to their first page.

Pages with no console errors at phone (Pixel emulation) and desktop (1440 × 900) size: `/` and
`/docs/getting-started`. Screenshots: `docs/evidence/seo/after-home-phone.png`, `after-home-desktop.png`. Nothing
visible changed: the only addition to the page body is a JSON-LD script tag.

## Keeping it true

`test/site-seo.test.mjs` fails when a new page under `site/src/app` neither sets its metadata with `pageMeta` (public,
with a canonical) nor marks itself `PRIVATE` (noindex), and when robots.txt, the sitemap or the JSON-LD stop coming
from `site/src/lib/seo.ts`.
