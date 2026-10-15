import type { MetadataRoute } from "next";
import { allDocs, allLegal } from "@/lib/docs";
import { appUrl } from "@/lib/flags";
import { sitemapFor } from "@/lib/seo";
import { livePostings } from "@/server/postings";

// Live jobs come and go, so the sitemap is rebuilt at most hourly rather than frozen at build time.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Without Firebase, or with Firestore down, the sitemap still lists every page that does not depend on it.
  const jobs = await livePostings().catch(() => []);
  return sitemapFor(appUrl, { docs: allDocs(), legal: allLegal(), jobs });
}
