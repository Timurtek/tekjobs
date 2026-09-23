import { NextResponse } from "next/server";
import { purchasesOpen } from "@/lib/flags";
import { currentIdentity } from "@/server/auth";
import { getPosting } from "@/server/postings";
import { createJobPostingCheckout, stripeConfigured } from "@/server/stripe";

export const runtime = "nodejs";

/** Start a Checkout Session for one draft posting the caller owns. Closed until purchases are open. */
export async function POST(request: Request) {
  if (!purchasesOpen) return NextResponse.json({ error: "Job posting is not on sale yet." }, { status: 503 });
  if (!stripeConfigured) return NextResponse.json({ error: "Payments are not configured on this deployment: STRIPE_SECRET_KEY or STRIPE_PRICE_JOB_POSTING is missing." }, { status: 503 });
  const who = await currentIdentity();
  if (!who) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { postingId?: string };
  if (!body.postingId) return NextResponse.json({ error: "Which posting?" }, { status: 400 });
  const posting = await getPosting(body.postingId);
  if (!posting || posting.ownerUid !== who.uid) return NextResponse.json({ error: "No such posting." }, { status: 404 });
  if (posting.status !== "draft") return NextResponse.json({ error: `This posting is ${posting.status}; only a draft can be paid for.` }, { status: 400 });
  try {
    const session = await createJobPostingCheckout({ userId: who.uid, email: who.email, postingId: posting.id });
    return NextResponse.json({ url: session.url, id: session.id });
  } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
