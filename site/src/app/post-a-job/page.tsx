import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { POSTING } from "@/content";
import { authConfigured, purchasesOpen } from "@/lib/flags";
import { currentIdentity } from "@/server/auth";

export const metadata: Metadata = { title: "Post a job" };
export const dynamic = "force-dynamic";

/**
 * The employer's front door. Signed in, it goes straight to their postings; signed out, it is the pitch,
 * the four steps, the price, and sign-in on the same page so the next click is the form.
 */
export default async function PostAJobPage() {
  if (await currentIdentity()) redirect("/app/post-a-job");
  return (
    <section className="section">
      <div className="wrap employer">
        <div className="employer__pitch">
          <span className="eyebrow">Post a job</span>
          <h1 className="title">Reach people who run their own search</h1>
          <p className="lead">
            TekJobs users do not browse a board. Their software reads hundreds of them every morning and scores each posting against criteria they wrote. A posting here is one more source in that scan: the people it fits find it, with the reasons, and apply to you directly.
          </p>
          <ol className="employer__steps">
            {POSTING.steps.map((s) => (
              <li key={s.title}>
                <strong>{s.title}.</strong> {s.body}
              </li>
            ))}
          </ol>
          <p className="employer__price"><span className="num">{POSTING.price}</span> for {POSTING.term}, paid once. <a href="/legal/refunds">Refunds</a> · <a href="/legal/terms#3-job-postings">Posting rules</a></p>
        </div>
        <div className="employer__side">
          {authConfigured ? (
            <>
              <p className="muted">Sign in to write your posting. It saves as a draft; you pay when it is ready.{!purchasesOpen ? " Payment is not open yet; drafts keep." : ""}</p>
              <AuthCard next="/app/post-a-job" />
            </>
          ) : (
            <p className="notice">Sign-in is not on for this deployment yet, so postings cannot be written here today. Watch the repository for the release that opens it.</p>
          )}
        </div>
      </div>
    </section>
  );
}
