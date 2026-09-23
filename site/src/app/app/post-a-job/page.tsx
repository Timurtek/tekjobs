import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PostingsEmpty } from "@/components/postings/PostingsEmpty";
import { PostingsTable } from "@/components/postings/PostingsTable";
import { POSTING } from "@/content";
import { currentIdentity } from "@/server/auth";
import { listPostings } from "@/server/postings";

export const metadata: Metadata = { title: "Your postings" };
export const dynamic = "force-dynamic";

/** The employer's postings: the table, or, with none yet, the empty state that says what a posting is and where to write one. */
export default async function PostingsPage({ searchParams }: { searchParams: Promise<{ paid?: string }> }) {
  const who = await currentIdentity();
  if (!who) redirect("/login?next=/app/post-a-job");
  const postings = await listPostings(who.uid).catch(() => []);
  const q = await searchParams;
  const justPaid = q.paid ? postings.find((p) => p.id === q.paid) : null;
  return (
    <section className="section">
      <div className="wrap stack">
        <div className="section__head">
          <span className="eyebrow">Your postings</span>
          <div className="section__head-text">
            <h1 className="title">{postings.length === 0 ? "No postings yet" : postings.length === 1 ? "One posting" : `${postings.length} postings`}</h1>
            {justPaid ? (
              <p className="notice notice--ok">{justPaid.status === "live" ? `Thank you. "${justPaid.title}" is live and enters the next morning's scan.` : `Thank you. "${justPaid.title}" goes live as soon as Stripe confirms the payment, usually within a minute; refresh to see it.`}</p>
            ) : (
              <p className="lead">Drafts wait until you pay; live postings run {POSTING.term} from the day they went live; closed ones stay here as the record.</p>
            )}
          </div>
        </div>
        {postings.length === 0 ? <PostingsEmpty /> : <PostingsTable postings={postings} />}
      </div>
    </section>
  );
}
