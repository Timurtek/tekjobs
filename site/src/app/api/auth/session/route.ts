import { NextResponse } from "next/server";
import { adminConfigured, createSessionCookie, SESSION_COOKIE, SESSION_MAX_AGE_MS, verifyIdToken } from "@/server/firebase";

export const runtime = "nodejs";

/** The client posts a fresh ID token; the server mints a two-week session cookie from it. */
export async function POST(request: Request) {
  if (!adminConfigured) return NextResponse.json({ error: "Auth is not configured on this deployment." }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as { idToken?: string };
  if (!body.idToken) return NextResponse.json({ error: "idToken required" }, { status: 400 });
  try {
    const decoded = await verifyIdToken(body.idToken);
    const cookie = await createSessionCookie(body.idToken);
    const res = NextResponse.json({ ok: true, uid: decoded.uid });
    res.cookies.set(SESSION_COOKIE, cookie, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE_MS / 1000 });
    return res;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 });
  }
}

/** Sign-out: the cookie goes; the client signs out of Firebase itself. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
