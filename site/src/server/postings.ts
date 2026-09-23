import "server-only";
import { adminConfigured, db } from "./firebase";
import { whereOf } from "@/lib/where";

/**
 * A job posting an employer writes here, in Firestore under `postings/{id}`. It is a draft until paid, live
 * for its term after the webhook publishes it, and closed by its owner or by time. Live postings are served
 * as a feed the TekJobs scan reads like any other board.
 */
export const WORKPLACES = ["remote", "hybrid", "onsite"] as const;
export const REGIONS = ["Worldwide", "United States", "Canada", "Americas", "Europe", "United Kingdom", "Asia-Pacific", "Africa", "Middle East"] as const;
export const EMPLOYMENT = ["full-time", "part-time", "contract", "internship"] as const;
export const SENIORITY = ["", "junior", "mid", "senior", "staff", "principal", "lead", "director"] as const;
export const TERM_DAYS = 30;

export type PostingStatus = "draft" | "live" | "closed" | "removed";
export type PostingInput = {
  title: string; company: string; companyUrl: string;
  location: string; workplace: (typeof WORKPLACES)[number]; regions: string[];
  employmentType: (typeof EMPLOYMENT)[number]; seniority: string; department: string;
  salaryMin: number; salaryMax: number; currency: "USD";
  description: string; applyUrl: string; applyEmail: string; tags: string[];
};
export type Posting = PostingInput & {
  id: string; ownerUid: string; ownerEmail: string; status: PostingStatus;
  createdAt: string; updatedAt: string; publishedAt: string; expiresAt: string; closedAt: string;
  entitlementId: string; stripeCheckoutSessionId: string;
};

const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const url = (v: unknown) => { const s = str(v, 500); if (!s) return ""; try { const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); return u.toString(); } catch { return ""; } };
const list = (v: unknown): string[] => (Array.isArray(v) ? v : v == null ? [] : [v]).map((x) => String(x));
const num = (v: unknown) => { const n = Number(String(v ?? "").replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? Math.round(n) : 0; };

/** Clean and check an input. Returns the clean input and the list of what is wrong, in the order the form shows fields. */
export function validatePosting(raw: Partial<PostingInput>): { input: PostingInput; errors: string[] } {
  const input: PostingInput = {
    title: str(raw.title, 120), company: str(raw.company, 120), companyUrl: url(raw.companyUrl),
    location: str(raw.location, 160), workplace: (WORKPLACES as readonly string[]).includes(String(raw.workplace)) ? (raw.workplace as PostingInput["workplace"]) : "remote",
    regions: list(raw.regions).map((r) => str(r, 40)).filter((r) => (REGIONS as readonly string[]).includes(r)),
    employmentType: (EMPLOYMENT as readonly string[]).includes(String(raw.employmentType)) ? (raw.employmentType as PostingInput["employmentType"]) : "full-time",
    seniority: (SENIORITY as readonly string[]).includes(String(raw.seniority ?? "")) ? String(raw.seniority ?? "") : "",
    department: str(raw.department, 80),
    salaryMin: num(raw.salaryMin), salaryMax: num(raw.salaryMax), currency: "USD",
    description: String(raw.description ?? "").trim().slice(0, 20000),
    applyUrl: url(raw.applyUrl), applyEmail: str(raw.applyEmail, 160).toLowerCase(),
    tags: list(raw.tags).flatMap((t) => t.split(",")).map((t) => str(t, 40).toLowerCase()).filter(Boolean).slice(0, 20),
  };
  const errors: string[] = [];
  if (input.title.length < 3) errors.push("A title, at least three characters.");
  if (input.company.length < 2) errors.push("The company's name.");
  if (input.workplace === "remote" && input.regions.length === 0) errors.push("For a remote role, at least one region it is open to.");
  if (input.workplace !== "remote" && !input.location) errors.push("The office location for a hybrid or on-site role.");
  if (!input.salaryMin || !input.salaryMax) errors.push("A pay range, both ends, in US dollars a year. Postings without one score lower for every reader.");
  else if (input.salaryMax < input.salaryMin) errors.push("The top of the pay range is below the bottom.");
  else if (input.salaryMin < 10000 || input.salaryMax > 2000000) errors.push("The pay range should be annual figures (for example 180000 to 240000).");
  if (input.description.length < 200) errors.push("A description of at least 200 characters. Keywords in the text are what the score reads.");
  if (!input.applyUrl && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.applyEmail)) errors.push("How candidates apply: a working application link, or an email address.");
  // A matching term counts only when the posting itself carries it; the form says so before this strips it.
  const haystack = `${input.title}\n${input.description}`.toLowerCase();
  input.tags = input.tags.filter((t) => haystack.includes(t));
  return { input, errors };
}

const col = () => db().collection("postings");
const now = () => new Date().toISOString();
const row = (id: string, d: FirebaseFirestore.DocumentData): Posting => ({ id, ...(d as Omit<Posting, "id">) });

export async function createPosting(owner: { uid: string; email: string | null }, input: PostingInput): Promise<Posting> {
  const t = now();
  const doc: Omit<Posting, "id"> = { ...input, ownerUid: owner.uid, ownerEmail: owner.email || "", status: "draft", createdAt: t, updatedAt: t, publishedAt: "", expiresAt: "", closedAt: "", entitlementId: "", stripeCheckoutSessionId: "" };
  const ref = await col().add(doc);
  return { id: ref.id, ...doc };
}

export async function getPosting(id: string): Promise<Posting | null> {
  const snap = await col().doc(id).get();
  return snap.exists ? row(snap.id, snap.data()!) : null;
}

/** The owner's postings, newest first. Sorted here rather than in the query so no composite index is needed. */
export async function listPostings(uid: string): Promise<Posting[]> {
  if (!adminConfigured) return [];
  const snap = await col().where("ownerUid", "==", uid).limit(200).get();
  return snap.docs.map((d) => row(d.id, d.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updatePosting(id: string, uid: string, input: PostingInput): Promise<Posting> {
  const p = await getPosting(id);
  if (!p || p.ownerUid !== uid) throw Object.assign(new Error("No such posting."), { status: 404 });
  if (p.status === "removed") throw Object.assign(new Error("This posting was removed and cannot be edited."), { status: 400 });
  await col().doc(id).update({ ...input, updatedAt: now() });
  return { ...p, ...input, updatedAt: now() };
}

export async function closePosting(id: string, uid: string): Promise<Posting> {
  const p = await getPosting(id);
  if (!p || p.ownerUid !== uid) throw Object.assign(new Error("No such posting."), { status: 404 });
  const t = now();
  await col().doc(id).update({ status: "closed", closedAt: t, updatedAt: t });
  return { ...p, status: "closed", closedAt: t, updatedAt: t };
}

/** Called by the webhook once Stripe says the session was paid: the draft goes live for the term. */
export async function publishPosting(id: string, { entitlementId, sessionId }: { entitlementId: string; sessionId: string }) {
  const p = await getPosting(id);
  if (!p) return { published: false, reason: "posting not found" };
  if (p.status === "live") return { published: false, reason: "already live" };
  const t = new Date();
  const expires = new Date(t.getTime() + TERM_DAYS * 86400e3);
  await col().doc(id).update({ status: "live", publishedAt: t.toISOString(), expiresAt: expires.toISOString(), updatedAt: t.toISOString(), entitlementId, stripeCheckoutSessionId: sessionId });
  return { published: true, expiresAt: expires.toISOString() };
}

/** What the scan reads: every live, unexpired posting in the same shape the scan's own fetchers produce. */
export async function livePostings() {
  if (!adminConfigured) return [];
  const snap = await col().where("status", "==", "live").limit(500).get();
  const t = now();
  return snap.docs.map((d) => row(d.id, d.data())).filter((p) => !p.expiresAt || p.expiresAt > t).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function toFeedJob(p: Posting, site: string) {
  const pay = p.salaryMin && p.salaryMax ? `$${Math.round(p.salaryMin / 1000)}k–$${Math.round(p.salaryMax / 1000)}k` : "";
  const location = whereOf(p);
  return {
    id: p.id, source: "tekjobs", company: p.company, title: p.title, url: `${site}/jobs/${p.id}`, applyUrl: p.applyUrl || undefined,
    location, remote: p.workplace === "remote", posted: p.publishedAt, expires: p.expiresAt,
    salary: pay, salaryMin: p.salaryMin, salaryMax: p.salaryMax, currency: p.currency,
    department: p.department, employmentType: p.employmentType, seniority: p.seniority, tags: p.tags,
    description: p.description, applyEmail: p.applyEmail || undefined, companyUrl: p.companyUrl || undefined,
  };
}
