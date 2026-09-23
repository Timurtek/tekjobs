import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocBody } from "@/components/DocBody";
import { ApplyButton } from "@/components/postings/ApplyButton";
import { appUrl } from "@/lib/flags";
import { getPosting, type Posting } from "@/server/postings";

export const dynamic = "force-dynamic";

const money = (n: number) => `$${Math.round(n / 1000)}k`;
const isLive = (p: Posting | null): p is Posting => !!p && p.status === "live" && (!p.expiresAt || p.expiresAt > new Date().toISOString());

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await getPosting((await params).id).catch(() => null);
  if (!isLive(p)) return { title: "Job not found" };
  return { title: `${p.title} at ${p.company}`, description: `${money(p.salaryMin)}–${money(p.salaryMax)} · ${p.workplace === "remote" ? `Remote (${p.regions.join(", ")})` : p.location}` };
}

/**
 * One live posting, readable by anyone, with the JSON-LD search engines index. Closed or expired postings are
 * gone from here; the employer keeps the record.
 */
export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getPosting(id).catch(() => null);
  if (!isLive(p)) notFound();
  const where = p.workplace === "remote" ? `Remote · ${p.regions.join(", ")}` : `${p.workplace === "hybrid" ? "Hybrid · " : ""}${p.location}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: p.title,
    description: p.description,
    datePosted: p.publishedAt,
    validThrough: p.expiresAt,
    employmentType: p.employmentType.toUpperCase().replace("-", "_"),
    hiringOrganization: { "@type": "Organization", name: p.company, ...(p.companyUrl ? { sameAs: p.companyUrl } : {}) },
    ...(p.workplace === "remote"
      ? { jobLocationType: "TELECOMMUTE", applicantLocationRequirements: p.regions.map((r) => ({ "@type": "Country", name: r })) }
      : { jobLocation: { "@type": "Place", address: p.location } }),
    baseSalary: { "@type": "MonetaryAmount", currency: "USD", value: { "@type": "QuantitativeValue", minValue: p.salaryMin, maxValue: p.salaryMax, unitText: "YEAR" } },
    directApply: !!p.applyUrl,
    url: `${appUrl}/jobs/${p.id}`,
  };
  return (
    <section className="section">
      <div className="wrap job">
        <article className="job__main">
          <header className="job__head">
            <a className="eyebrow" href="/jobs">← All jobs</a>
            <span className="job__company">{p.company}{p.department ? ` · ${p.department}` : ""}</span>
            <h1 className="title">{p.title}</h1>
            <p className="job__meta num">
              <span className="job__pay">{money(p.salaryMin)}–{money(p.salaryMax)} a year</span>
              <span>{where}</span>
              <span>{p.employmentType}{p.seniority ? ` · ${p.seniority}` : ""}</span>
            </p>
          </header>
          <DocBody text={p.description} />
          {p.tags.length > 0 && <p className="job__tags mono">{p.tags.join(" · ")}</p>}
        </article>
        <aside className="job__aside">
          <div className="pcard">
            <span className="microlabel">Apply</span>
            <ApplyButton applyUrl={p.applyUrl} applyEmail={p.applyEmail} title={p.title} company={p.company} />
            <p className="muted pcard__note">You apply to {p.company} directly. TekJobs is not in the middle and never sees who applied.</p>
            <div className="pcard__reasons">
              <div><span>posted</span><span className="num">{p.publishedAt.slice(0, 10)}</span></div>
              <div><span>runs until</span><span className="num">{p.expiresAt.slice(0, 10)}</span></div>
              {p.companyUrl && <div><span>company</span><a className="num" href={p.companyUrl} target="_blank" rel="noreferrer">{new URL(p.companyUrl).hostname.replace(/^www\./, "")}</a></div>}
            </div>
            <p className="muted pcard__note">Run your own search? This posting is already in your morning scan as source <span className="mono">tekjobs</span>.</p>
          </div>
        </aside>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </div>
    </section>
  );
}
