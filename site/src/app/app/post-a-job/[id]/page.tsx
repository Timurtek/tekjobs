import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PostingForm } from "@/components/postings/PostingForm";
import { purchasesOpen } from "@/lib/flags";
import { currentIdentity } from "@/server/auth";
import { getPosting } from "@/server/postings";

export const metadata: Metadata = { title: "Edit posting" };
export const dynamic = "force-dynamic";

export default async function EditPostingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ canceled?: string }> }) {
  const who = await currentIdentity();
  const { id } = await params;
  if (!who) redirect(`/login?next=/app/post-a-job/${id}`);
  const posting = await getPosting(id).catch(() => null);
  if (!posting || posting.ownerUid !== who.uid) notFound();
  const q = await searchParams;
  return (
    <section className="section">
      <div className="wrap">
        <div className="section__head">
          <span className="eyebrow">{posting.status === "draft" ? "Draft" : posting.status}</span>
          <div className="section__head-text">
            <h1 className="title">{posting.title}</h1>
            {q.canceled && <p className="notice">Checkout was canceled. Nothing was charged; the draft is still here.</p>}
            <p className="lead">
              {posting.status === "draft" && "Edit freely; pay when it is ready."}
              {posting.status === "live" && `Live since ${posting.publishedAt.slice(0, 10)}, until ${posting.expiresAt.slice(0, 10)}. Edits reach the feed on its next read.`}
              {posting.status === "closed" && `Closed on ${posting.closedAt.slice(0, 10)}. Kept as the record.`}
            </p>
          </div>
        </div>
        <PostingForm posting={posting} purchasesOpen={purchasesOpen} />
      </div>
    </section>
  );
}
