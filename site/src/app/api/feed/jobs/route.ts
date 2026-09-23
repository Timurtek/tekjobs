import { NextResponse } from "next/server";
import { appUrl } from "@/lib/flags";
import { livePostings, toFeedJob } from "@/server/postings";

export const runtime = "nodejs";
export const revalidate = 300;

/**
 * The public feed the TekJobs scan reads: every live posting, in the normalized job shape. Anyone may read it;
 * that is the point. Five minutes of cache is plenty for a feed read once a morning.
 */
export async function GET() {
  const jobs = (await livePostings().catch(() => [])).map((p) => toFeedJob(p, appUrl));
  return NextResponse.json({ source: "tekjobs", generated: new Date().toISOString(), count: jobs.length, jobs }, { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=600", "access-control-allow-origin": "*" } });
}
