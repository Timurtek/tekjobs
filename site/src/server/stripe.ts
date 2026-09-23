import "server-only";
import { appUrl } from "@/lib/flags";

/**
 * Stripe over its REST API, no SDK: one call to create a Checkout Session. The product is a job posting;
 * the Price id comes from the environment and is never written into code. Mode is one-time payment. The
 * posting being paid for rides in the metadata so the webhook can publish it.
 */
export const stripeConfigured = !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_JOB_POSTING);

export const SKU = { jobPosting: "job_posting" } as const;

export async function createJobPostingCheckout({ userId, email, postingId }: { userId: string; email?: string | null; postingId: string }) {
  if (!stripeConfigured) throw Object.assign(new Error("Payments are not configured on this deployment."), { status: 503 });
  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price]": process.env.STRIPE_PRICE_JOB_POSTING!,
    "line_items[0][quantity]": "1",
    success_url: `${appUrl}/app/post-a-job?paid=${encodeURIComponent(postingId)}`,
    cancel_url: `${appUrl}/app/post-a-job/${encodeURIComponent(postingId)}?canceled=1`,
    client_reference_id: userId,
    "metadata[userId]": userId,
    "metadata[sku]": SKU.jobPosting,
    "metadata[postingId]": postingId,
    allow_promotion_codes: "true",
  });
  if (email) params.set("customer_email", email);
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = (await r.json()) as { id?: string; url?: string; error?: { message: string } };
  if (!r.ok || !data.url) throw Object.assign(new Error(data.error?.message || `Stripe answered ${r.status}`), { status: 502 });
  return { id: data.id!, url: data.url };
}
