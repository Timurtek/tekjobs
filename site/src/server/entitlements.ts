import "server-only";
import { adminConfigured, db } from "./firebase";

/**
 * What a payment bought, in Firestore under `entitlements/{id}`: the same document shape the AstroSense web
 * app writes, so one dashboard and one set of rules can read both. Idempotent on the Checkout Session id,
 * and granted only when Stripe says the session was paid.
 */
export type Entitlement = {
  id: string;
  userId: string;
  sku: string;
  status: "active" | "consumed" | "refunded";
  createdAt: string;
  updatedAt: string;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId?: string;
  priceId?: string;
  email?: string;
  consumedAt?: string;
  revokedAt?: string;
};

type CheckoutSession = { id: string; payment_status?: string; payment_intent?: string | null; customer_details?: { email?: string | null } | null; client_reference_id?: string | null; metadata?: Record<string, string> };

export async function grantFromCheckoutSession(session: CheckoutSession) {
  if (session.payment_status !== "paid") return { granted: false, reason: `payment_status ${session.payment_status}` };
  const userId = session.metadata?.userId || session.client_reference_id;
  const sku = session.metadata?.sku;
  if (!userId || !sku) return { granted: false, reason: "no userId or sku in metadata" };
  const col = db().collection("entitlements");
  const existing = await col.where("stripeCheckoutSessionId", "==", session.id).limit(1).get();
  if (!existing.empty) return { granted: false, reason: "already recorded", id: existing.docs[0]!.id };
  const now = new Date().toISOString();
  const doc: Omit<Entitlement, "id"> = {
    userId, sku, status: "active", createdAt: now, updatedAt: now, stripeCheckoutSessionId: session.id,
    ...(session.payment_intent ? { stripePaymentIntentId: String(session.payment_intent) } : {}),
    ...(session.customer_details?.email ? { email: session.customer_details.email } : {}),
  };
  const ref = await col.add(doc);
  return { granted: true, id: ref.id };
}

export async function revokeByPaymentIntent(paymentIntentId: string) {
  const col = db().collection("entitlements");
  const hits = await col.where("stripePaymentIntentId", "==", paymentIntentId).get();
  const now = new Date().toISOString();
  await Promise.all(hits.docs.map((d) => d.ref.update({ status: "refunded", revokedAt: now, updatedAt: now })));
  return { revoked: hits.size };
}

export async function listEntitlements(userId: string): Promise<Entitlement[]> {
  if (!adminConfigured) return [];
  const snap = await db().collection("entitlements").where("userId", "==", userId).orderBy("createdAt", "desc").limit(50).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Entitlement, "id">) }));
}
