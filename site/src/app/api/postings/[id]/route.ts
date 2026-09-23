import { NextResponse } from "next/server";
import { currentIdentity } from "@/server/auth";
import { adminConfigured } from "@/server/firebase";
import { closePosting, getPosting, updatePosting, validatePosting } from "@/server/postings";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

const fail = (e: unknown) => { const err = e as Error & { status?: number }; return NextResponse.json({ error: err.message }, { status: err.status || 500 }); };

export async function GET(_: Request, { params }: Ctx) {
  if (!adminConfigured) return NextResponse.json({ error: "Not configured." }, { status: 503 });
  const who = await currentIdentity();
  if (!who) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const p = await getPosting((await params).id);
  if (!p || p.ownerUid !== who.uid) return NextResponse.json({ error: "No such posting." }, { status: 404 });
  return NextResponse.json({ posting: p });
}

/** Edit. A live posting can be edited too; the feed serves the new text on its next read. */
export async function PATCH(request: Request, { params }: Ctx) {
  if (!adminConfigured) return NextResponse.json({ error: "Not configured." }, { status: 503 });
  const who = await currentIdentity();
  if (!who) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const { input, errors } = validatePosting(body);
  if (errors.length) return NextResponse.json({ error: "The posting is not complete.", errors }, { status: 400 });
  try { return NextResponse.json({ posting: await updatePosting((await params).id, who.uid, input) }); } catch (e) { return fail(e); }
}

/** Close: the posting leaves the feed; the record stays. */
export async function DELETE(_: Request, { params }: Ctx) {
  if (!adminConfigured) return NextResponse.json({ error: "Not configured." }, { status: 503 });
  const who = await currentIdentity();
  if (!who) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try { return NextResponse.json({ posting: await closePosting((await params).id, who.uid) }); } catch (e) { return fail(e); }
}
