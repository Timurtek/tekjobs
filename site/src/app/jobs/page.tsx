import type { Metadata } from "next";
import { POSTING } from "@/content";
import { livePostings } from "@/server/postings";

export const metadata: Metadata = { title: "Jobs", description: "Every job posted on TekJobs and live today. The same postings every TekJobs user's morning scan reads." };
export const dynamic = "force-dynamic";

const money = (n: number) => `$${Math.round(n / 1000)}k`;
const days = (iso: string) => { const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400e3); return d <= 0 ? "today" : d === 1 ? "1 day ago" : `${d} days ago`; };

/** The public board: what is live, newest first. It is the feed with a face; the scan reads the same rows. */
export default async function JobsPage() {
  const jobs = await livePostings().catch(() => []);
  return (
    <section className="section">
      <div className="wrap stack">
        <div className="section__head">
          <span className="eyebrow">Jobs</span>
          <div className="section__head-text">
            <h1 className="title">{jobs.length === 0 ? "Nothing live right now" : jobs.length === 1 ? "One job live" : `${jobs.length} jobs live`}</h1>
            <p className="lead">Every posting employers have paid to run here, for {POSTING.term} each. The same rows every TekJobs user&apos;s morning scan reads and scores against their own criteria; this page is for everyone else. <a href="/post-a-job">Post one</a>.</p>
          </div>
        </div>
        {jobs.length > 0 && (
          <ol className="jobs">
            {jobs.map((j) => (
              <li key={j.id}>
                <a className="jobrow" href={`/jobs/${j.id}`}>
                  <span className="jobrow__company">{j.company}{j.department ? ` · ${j.department}` : ""}</span>
                  <span className="jobrow__title">{j.title}</span>
                  <span className="jobrow__meta num">
                    <span className="jobrow__pay">{money(j.salaryMin)}–{money(j.salaryMax)}</span>
                    <span>{j.workplace === "remote" ? `Remote · ${j.regions.join(", ")}` : j.workplace === "hybrid" ? `Hybrid · ${j.location}` : j.location}</span>
                    <span>{j.employmentType}{j.seniority ? ` · ${j.seniority}` : ""}</span>
                    <span className="muted">{days(j.publishedAt)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
