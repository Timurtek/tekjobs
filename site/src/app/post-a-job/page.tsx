import type { Metadata } from "next";
import { CheckoutButton } from "@/components/CheckoutButton";
import { purchasesOpen } from "@/lib/flags";

export const metadata: Metadata = { title: "Post a job" };

/**
 * Job posting: the one thing this site will sell. Until purchases open this page says so; after, the button
 * starts a Stripe Checkout for a signed-in account and the webhook records the purchase.
 */
export default async function PostAJobPage({ searchParams }: { searchParams: Promise<{ paid?: string; canceled?: string }> }) {
  const q = await searchParams;
  return (
    <section className="section">
      <div className="wrap narrow stack">
        <span className="eyebrow">Post a job</span>
        <h1 className="title">Reach people who run their own search</h1>
        <p className="lead">
          A posting here lands in the scan every TekJobs user runs each morning, scored against their criteria like any other board. No inbox blast; the people it fits see it, with the reasons.
        </p>
        {q.paid && <p className="notice notice--ok">Thank you. Your posting is recorded; the next step comes by email.</p>}
        {q.canceled && <p className="notice">Checkout was canceled. Nothing was charged.</p>}
        <CheckoutButton open={purchasesOpen} />
      </div>
    </section>
  );
}
