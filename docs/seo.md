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
