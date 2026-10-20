import type { Metadata, MetadataRoute } from "next";

/**
 * What search engines and AI assistants read: each page's title, description, canonical URL and Open Graph card,
 * the sitemap, robots.txt, and the JSON-LD. Paths are relative; the layout's metadataBase makes them absolute.
 * Imports nothing at runtime, so the tests run it directly.
 */
export const SITE_NAME = "TekJobs";
export const SITE_DESCRIPTION = "A job search that remembers who you are. Your resume, criteria, decisions and applications as markdown on your own machine; your AI works from it over MCP. Scans hundreds of company boards, says why each role matched, stops before anything is sent.";
export const SHORT_DESCRIPTION = "A job search that remembers who you are. Local-first, open source, your AI over MCP.";
export const SOCIAL_IMAGE = { url: "/brand/social-preview.png", width: 1280, height: 640, alt: "TekJobs: a job search that remembers who you are" };

/** Signed-in and sign-in pages: kept out of the index, links not followed. */
export const PRIVATE: Metadata = { robots: { index: false, follow: false } };

type PageMeta = { title: string; description: string; path: string; type?: "website" | "article"; openGraph?: Metadata["openGraph"] };

/**
 * One public page's metadata. `title` is the page's own name; the layout's template adds " · TekJobs" to the
 * document title, and the share card carries the same full title. A title that already starts with the site's
 * name is used as it is. A page's Open Graph block replaces the layout's whole, so the image is repeated here.
 */
export function pageMeta({ title, description, path, type = "website", openGraph }: PageMeta): Metadata {
  const full = title.startsWith(SITE_NAME) ? title : `${title} · ${SITE_NAME}`;
  return {
    title: full === title ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: { title: full, description, url: path, siteName: SITE_NAME, type, images: [SOCIAL_IMAGE], ...openGraph } as Metadata["openGraph"],
    twitter: { card: "summary_large_image", title: full, description, images: [SOCIAL_IMAGE.url] },
  };
}

/** Everything a crawler may read, except the API and the signed-in app. The sitemap is named for the ones that look. */
export function robotsFor(siteUrl: string): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/app/"] }],
    sitemap: new URL("/sitemap.xml", siteUrl).href,
    host: new URL(siteUrl).host,
  };
}

type Page = { slug: string; updated?: string };
type Job = { id: string; publishedAt: string; updatedAt?: string };

/**
 * Every public page: the landing page, the board, the employer page, each doc, each legal page, each live job.
 * The /docs and /legal indexes are left out because they redirect to their first page.
 */
export function sitemapFor(siteUrl: string, { docs, legal, jobs }: { docs: Page[]; legal: Page[]; jobs: Job[] }): MetadataRoute.Sitemap {
  const at = (path: string) => new URL(path, siteUrl).href;
  // A date that does not parse is left out rather than written as an invalid lastmod.
  const modified = (iso?: string) => (iso && !Number.isNaN(Date.parse(iso)) ? { lastModified: new Date(iso) } : {});
  return [
    { url: at("/"), changeFrequency: "weekly", priority: 1 },
    { url: at("/jobs"), changeFrequency: "daily", priority: 0.8 },
    { url: at("/post-a-job"), changeFrequency: "monthly", priority: 0.6 },
    ...docs.map((d) => ({ url: at(`/docs/${d.slug}`), ...modified(d.updated), changeFrequency: "monthly" as const, priority: 0.7 })),
    ...legal.map((d) => ({ url: at(`/legal/${d.slug}`), ...modified(d.updated), changeFrequency: "yearly" as const, priority: 0.3 })),
    ...jobs.map((j) => ({ url: at(`/jobs/${j.id}`), ...modified(j.updatedAt || j.publishedAt), changeFrequency: "weekly" as const, priority: 0.5 })),
  ];
}

/**
 * JSON for a `<script type="application/ld+json">`. `<` is escaped so text from a posting or a doc can never
 * close the script tag; a JSON parser reads the escape back as `<`.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** The landing page's graph: who publishes TekJobs, the site, and the software itself. */
export function homeLd({ siteUrl, repo, npm, author }: { siteUrl: string; repo: string; npm: string; author: string }) {
  const at = (path: string) => new URL(path, siteUrl).href;
  const org = { "@type": "Organization", "@id": `${author}/#organization`, name: "Timurtek LLC", url: author, founder: { "@type": "Person", name: "Timurtek Bizel", url: author } };
  return {
    "@context": "https://schema.org",
    "@graph": [
      org,
      { "@type": "WebSite", "@id": at("/#website"), name: SITE_NAME, url: at("/"), description: SHORT_DESCRIPTION, publisher: { "@id": org["@id"] } },
      {
        "@type": "SoftwareApplication",
        "@id": at("/#software"),
        name: SITE_NAME,
        url: at("/"),
        description: SITE_DESCRIPTION,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Windows, macOS, Linux",
        image: at(SOCIAL_IMAGE.url),
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        license: "https://opensource.org/licenses/MIT",
        downloadUrl: npm,
        sameAs: [repo, npm],
        author: { "@type": "Person", name: "Timurtek Bizel", url: author },
        publisher: { "@id": org["@id"] },
      },
    ],
  };
}

/** A docs page: a technical article about TekJobs, published by Timurtek LLC. */
export function articleLd({ siteUrl, path, title, description, author }: { siteUrl: string; path: string; title: string; description: string; author: string }) {
  const at = (p: string) => new URL(p, siteUrl).href;
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: title,
    description,
    url: at(path),
    mainEntityOfPage: at(path),
    image: at(SOCIAL_IMAGE.url),
    inLanguage: "en",
    isPartOf: { "@type": "WebSite", "@id": at("/#website"), name: SITE_NAME, url: at("/") },
    about: { "@id": at("/#software") },
    author: { "@type": "Person", name: "Timurtek Bizel", url: author },
    publisher: { "@type": "Organization", "@id": `${author}/#organization`, name: "Timurtek LLC", url: author },
  };
}
