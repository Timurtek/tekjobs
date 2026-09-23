import { NextResponse } from "next/server";
import { currentIdentity } from "@/server/auth";
import { adminConfigured } from "@/server/firebase";
import { createPosting, listPostings, validatePosting } from "@/server/postings";

export const runtime = "nodejs";

/** The signed-in employer's postings. */
export async function GET() {
  if (!adminConfigured) return NextResponse.json({ error: "Not configured." }, { status: 503 });
  const who = await currentIdentity();
  if (!who) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  return NextResponse.json({ postings: await listPostings(who.uid) });
}

/** A new draft. Validation errors come back as a list, in the order the form shows the fields. */
export async function POST(request: Request) {
  if (!adminConfigured) return NextResponse.json({ error: "Not configured." }, { status: 503 });
  const who = await currentIdentity();
  if (!who) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const { input, errors } = validatePosting(body);
  if (errors.length) return NextResponse.json({ error: "The posting is not complete.", errors }, { status: 400 });
  const posting = await createPosting(who, input);
  return NextResponse.json({ posting }, { status: 201 });
}
