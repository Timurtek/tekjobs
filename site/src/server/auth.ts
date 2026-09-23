import "server-only";
import { cookies, headers } from "next/headers";
import { adminConfigured, SESSION_COOKIE, verifyIdToken, verifySessionCookie } from "./firebase";

export type Identity = { uid: string; email: string | null; via: "bearer" | "session" };

/**
 * Who is calling, in this order: an `Authorization: Bearer <idToken>` header (the client right after sign-in,
 * before the cookie exists), then the session cookie. Anything else is nobody. Same precedence as the
 * AstroSense web app, minus its anonymous identity: this site has nothing to give a visitor before sign-in.
 */
export async function currentIdentity(): Promise<Identity | null> {
  if (!adminConfigured) return null;
  const h = await headers();
  const bearer = h.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) {
    try { const t = await verifyIdToken(bearer); return { uid: t.uid, email: t.email ?? null, via: "bearer" }; } catch { /* fall through to the cookie */ }
  }
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (cookie) {
    try { const t = await verifySessionCookie(cookie); return { uid: t.uid, email: t.email ?? null, via: "session" }; } catch { return null; }
  }
  return null;
}

export async function currentUid(): Promise<string | null> {
  return (await currentIdentity())?.uid ?? null;
}
