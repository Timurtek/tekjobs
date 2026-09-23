import { NextResponse } from "next/server";
import { adminConfigured } from "@/server/firebase";
import { grantFromCheckoutSession, revokeByPaymentIntent } from "@/server/entitlements";
import { publishPosting } from "@/server/postings";
import { constructVerifiedEvent } from "@/server/stripeSignature";

export const runtime = "nodejs";

type StripeEvent = { id: string; type: string; data: { object: Record<string, unknown> } };

/**
 * Stripe calls this. The raw body is verified against the signing secret before anything is parsed; a paid
 * Checkout Session grants an entitlement and publishes the posting it named, a refund revokes, everything
 * else is acknowledged and ignored.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !adminConfigured) return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  const raw = await request.text();
  let event: StripeEvent;
  try { event = constructVerifiedEvent<StripeEvent>(raw, request.headers.get("stripe-signature"), secret); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Parameters<typeof grantFromCheckoutSession>[0] & { metadata?: Record<string, string> };
        const grant = await grantFromCheckoutSession(session);
        const postingId = session.metadata?.postingId;
        const published = grant.id && postingId ? await publishPosting(postingId, { entitlementId: grant.id, sessionId: session.id }) : { published: false, reason: "no posting or no grant" };
        return NextResponse.json({ received: true, grant, published });
      }
      case "charge.refunded": {
        const pi = event.data.object.payment_intent;
        const r = pi ? await revokeByPaymentIntent(String(pi)) : { revoked: 0 };
        return NextResponse.json({ received: true, ...r });
      }
      default:
        return NextResponse.json({ received: true, ignored: event.type });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
