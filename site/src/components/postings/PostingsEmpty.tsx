"use client";
import { Button } from "@/components/ui";
import { POSTING } from "@/content";

/** The postings page before the first posting: what one is, what it costs, and the button that starts it. */
export function PostingsEmpty() {
  return (
    <div className="empty">
      <div className="empty__text">
        <h2>Write your first posting</h2>
        <p className="muted">It saves as a draft as you go and costs nothing until you publish. When it is ready you pay {POSTING.price} once, and it enters every TekJobs user&apos;s morning scan for {POSTING.term}. State the pay: it is required, and it is what readers filter on first.</p>
      </div>
      <div className="hero__actions">
        <Button asChild tone="primary"><a href="/app/post-a-job/new">New posting</a></Button>
        <Button asChild variant="ghost"><a href="/docs/posting-a-job">How posting works</a></Button>
      </div>
    </div>
  );
}
