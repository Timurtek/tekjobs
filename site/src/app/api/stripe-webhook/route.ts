import { NextResponse } from "next/server";
import { adminConfigured } from "@/server/firebase";
import { grantFromCheckoutSession, revokeByPaymentIntent } from "@/server/entitlements";
import { constructVerifiedEvent } from "@/server/stripeSignature";

export const runtime = "nodejs";

type StripeEvent = { id: string; type: string; data: { object: Record<string, unknown> } };

/**
 * Stripe calls this. The raw body is verified against the signing secret before anything is parsed; a paid
 * Checkout Session grants an entitlement, a refund revokes it, everything else is acknowledged and ignored.
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
        const r = await grantFromCheckoutSession(event.data.object as Parameters<typeof grantFromCheckoutSession>[0]);
        return NextResponse.json({ received: true, ...r });
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
