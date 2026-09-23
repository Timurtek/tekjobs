import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a Stripe webhook signature without the Stripe SDK: the `t=...,v1=...` header, HMAC-SHA256 over
 * `${t}.${rawBody}` with the endpoint's signing secret, constant-time compared, five minutes of tolerance.
 * The same routine the AstroSense web app uses.
 */
export function constructVerifiedEvent<T = unknown>(rawBody: string, header: string | null, secret: string, toleranceSeconds = 300): T {
  if (!header) throw new Error("Missing stripe-signature header");
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const t = parts.t;
  const v1 = header.split(",").filter((kv) => kv.startsWith("v1=")).map((kv) => kv.slice(3));
  if (!t || v1.length === 0) throw new Error("Malformed stripe-signature header");
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(t));
  if (!Number.isFinite(age) || age > toleranceSeconds) throw new Error("Webhook timestamp outside tolerance");
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`, "utf8").digest("hex");
  const ok = v1.some((sig) => sig.length === expected.length && timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex")));
  if (!ok) throw new Error("Webhook signature did not match");
  return JSON.parse(rawBody) as T;
}
