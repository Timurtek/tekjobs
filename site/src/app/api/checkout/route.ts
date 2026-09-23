import { NextResponse } from "next/server";
import { purchasesOpen } from "@/lib/flags";
import { currentIdentity } from "@/server/auth";
import { createJobPostingCheckout, stripeConfigured } from "@/server/stripe";

export const runtime = "nodejs";

/** Start a Checkout Session for one job posting. Signed-in only; closed until purchases are open. */
export async function POST() {
  if (!purchasesOpen || !stripeConfigured) return NextResponse.json({ error: "Job posting is not on sale yet." }, { status: 503 });
  const who = await currentIdentity();
  if (!who) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    const session = await createJobPostingCheckout({ userId: who.uid, email: who.email });
    return NextResponse.json({ url: session.url, id: session.id });
  } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
