import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PostingForm } from "@/components/postings/PostingForm";
import { purchasesOpen } from "@/lib/flags";
import { currentIdentity } from "@/server/auth";

export const metadata: Metadata = { title: "New posting" };
export const dynamic = "force-dynamic";

export default async function NewPostingPage() {
  if (!(await currentIdentity())) redirect("/login?next=/app/post-a-job/new");
  return (
    <section className="section">
      <div className="wrap">
        <div className="section__head">
          <span className="eyebrow">New posting</span>
          <div className="section__head-text">
            <h1 className="title">Write the posting</h1>
            <p className="lead">It saves as a draft. When it is ready you pay once, and it enters every TekJobs user&apos;s morning scan for 30 days.</p>
          </div>
        </div>
        <PostingForm purchasesOpen={purchasesOpen} />
      </div>
    </section>
  );
}
