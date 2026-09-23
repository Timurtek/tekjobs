"use client";
import { Badge, Button, Card, Checkbox, Markdown, Select, Tabs, TextArea, TextField, toast } from "@/components/ui";
import { useMemo, useState } from "react";
import type { Posting, PostingInput } from "@/server/postings";
import { whereOf } from "@/lib/where";

const WORKPLACES = [["remote", "Remote"], ["hybrid", "Hybrid"], ["onsite", "On-site"]] as const;
const REGIONS = ["Worldwide", "United States", "Canada", "Americas", "Europe", "United Kingdom", "Asia-Pacific", "Africa", "Middle East"];
const EMPLOYMENT = [["full-time", "Full-time"], ["part-time", "Part-time"], ["contract", "Contract"], ["internship", "Internship"]] as const;
const SENIORITY = [["", "Not stated"], ["junior", "Junior"], ["mid", "Mid"], ["senior", "Senior"], ["staff", "Staff"], ["principal", "Principal"], ["lead", "Lead"], ["director", "Director"]] as const;
const PRICE = "$49";

const blank: PostingInput = { title: "", company: "", companyUrl: "", location: "", workplace: "remote", regions: ["United States"], employmentType: "full-time", seniority: "", department: "", salaryMin: 0, salaryMax: 0, currency: "USD", description: "", applyUrl: "", applyEmail: "", tags: [] };
const money = (n: number) => (n ? `$${Math.round(n / 1000)}k` : "");
const withCommas = (n: number) => (n ? n.toLocaleString("en-US") : "");
const digits = (s: string) => Number(s.replace(/[^0-9]/g, "")) || 0;

type Busy = "" | "save" | "pay-save" | "pay-open" | "close";

/**
 * The posting form. Everything the scan scores on is a field here, in the order a reader meets it: what the
 * job is, where, what it pays, what the work is, how to apply. Saves as a draft; pays from the same page.
 * The right column shows the card as it appears on the board, then the signals the score can read from it.
 */
export function PostingForm({ posting, purchasesOpen }: { posting?: Posting; purchasesOpen: boolean }) {
  const [f, setF] = useState<PostingInput>(posting ? { ...blank, ...posting } : blank);
  const [id, setId] = useState(posting?.id ?? "");
  const [status] = useState(posting?.status ?? "draft");
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState<Busy>("");
  const [savedAt, setSavedAt] = useState<string>(posting?.updatedAt ?? "");
  const [payError, setPayError] = useState<string>("");
  const [applyVia, setApplyVia] = useState<"website" | "email">(posting && posting.applyEmail && !posting.applyUrl ? "email" : "website");
  const [tagsText, setTagsText] = useState((posting?.tags ?? []).join(", "));
  const set = <K extends keyof PostingInput>(k: K, v: PostingInput[K]) => setF((cur) => ({ ...cur, [k]: v }));
  const locked = status === "closed" || status === "removed";
  const remote = f.workplace === "remote";

  // Matching terms only count when the description or title carries them; say so before the server strips them.
  const tags = useMemo(() => tagsText.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean), [tagsText]);
  const haystack = useMemo(() => `${f.title}\n${f.description}`.toLowerCase(), [f.title, f.description]);
  const unsupported = tags.filter((t) => !haystack.includes(t));
  const payload = useMemo(() => ({ ...f, tags, applyUrl: applyVia === "website" ? f.applyUrl : "", applyEmail: applyVia === "email" ? f.applyEmail : "" }), [f, tags, applyVia]);
  const payBelowMin = f.salaryMin > 0 && f.salaryMax > 0 && f.salaryMax < f.salaryMin;

  const save = async (kind: Busy = "save"): Promise<string | null> => {
    setBusy(kind);
    try {
      const r = await fetch(id ? `/api/postings/${encodeURIComponent(id)}` : "/api/postings", { method: id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = (await r.json()) as { posting?: Posting; error?: string; errors?: string[] };
      if (!r.ok) {
        setErrors(data.errors ?? [data.error ?? `Saving answered ${r.status}`]);
        toast({ title: "Not saved yet", description: data.errors ? `${data.errors.length} thing${data.errors.length === 1 ? "" : "s"} to fix, listed above the form.` : data.error, tone: "danger" });
        window.scrollTo({ top: 0, behavior: "smooth" });
        return null;
      }
      setErrors([]);
      const saved = data.posting!;
      if (!id) { setId(saved.id); window.history.replaceState(null, "", `/app/post-a-job/${saved.id}`); }
      setSavedAt(saved.updatedAt);
      if (kind === "save") toast({ title: id ? "Saved" : "Draft saved", description: `${saved.title} at ${saved.company}. Nothing is charged until you pay.`, tone: "success" });
      return saved.id;
    } catch (e) { toast({ title: "Not saved", description: (e as Error).message, tone: "danger" }); return null; }
    finally { if (kind === "save") setBusy(""); }
  };

  const pay = async () => {
    setPayError("");
    const savedId = await save("pay-save");
    if (!savedId) { setBusy(""); return; }
    setBusy("pay-open");
    try {
      const r = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ postingId: savedId }) });
      const data = (await r.json()) as { url?: string; error?: string };
      if (!r.ok || !data.url) throw new Error(data.error || `Checkout answered ${r.status}`);
      window.location.assign(data.url);
    } catch (e) { setPayError((e as Error).message); setBusy(""); }
  };

  const close = async () => {
    if (!id || !window.confirm("Close this posting? It leaves the feed and cannot be reopened; a new posting is a new purchase.")) return;
    setBusy("close");
    try { const r = await fetch(`/api/postings/${encodeURIComponent(id)}`, { method: "DELETE" }); if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error || `Answered ${r.status}`); window.location.assign("/app/post-a-job"); }
    catch (e) { toast({ title: "Not closed", description: (e as Error).message, tone: "danger" }); setBusy(""); }
  };

  const where = remote ? whereOf(f) : f.location ? whereOf(f) : `${f.workplace === "hybrid" ? "Hybrid · " : ""}office location`;
  const payLabel = busy === "pay-save" ? "Saving draft…" : busy === "pay-open" ? "Opening secure checkout…" : `Continue to checkout, ${PRICE}`;

  return (
    <div className="pform">
      <div className="pform__main">
        {errors.length > 0 && (
          <div className="notice pform__errors" role="alert">
            <strong>Before this can be saved:</strong>
            <ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}

        <details className="pform__how">
          <summary>How this posting is scored</summary>
          <p>Every TekJobs user runs their own scan with criteria they wrote: title terms with weights, keywords, a pay floor with a stretch band, a remote rule, and recency. Your posting is scored against each reader&apos;s criteria like any other board&apos;s. The title earns the most, then keywords found in the description (capped, so vocabulary cannot outrank fit), pay at or above the reader&apos;s floor, and remote when the reader wants remote. Nothing here buys a place in the ranking; a plain, complete posting is what scores.</p>
        </details>

        <Card padding="lg">
          <div className="form">
            <h2 className="pform__h">The job</h2>
            <TextField label="Title *" placeholder="Senior Design Engineer" value={f.title} onChange={(e) => set("title", e.target.value)} disabled={locked} description="The title as you would write it on your own careers page." />
            <div className="form__row">
              <TextField label="Company *" value={f.company} onChange={(e) => set("company", e.target.value)} disabled={locked} />
              <TextField label="Company website" placeholder="https://" value={f.companyUrl} onChange={(e) => set("companyUrl", e.target.value)} disabled={locked} />
            </div>
            <div className="form__row">
              <Select label="Employment *" value={f.employmentType} onValueChange={(v) => set("employmentType", v as PostingInput["employmentType"])} disabled={locked}>
                {EMPLOYMENT.map(([v, l]) => <Select.Item key={v} value={v}>{l}</Select.Item>)}
              </Select>
              <Select label="Seniority" value={f.seniority || "none"} onValueChange={(v) => set("seniority", v === "none" ? "" : v)} disabled={locked}>
                {SENIORITY.map(([v, l]) => <Select.Item key={v || "none"} value={v || "none"}>{l}</Select.Item>)}
              </Select>
            </div>
            <TextField label="Department or team" placeholder="Design Systems" value={f.department} onChange={(e) => set("department", e.target.value)} disabled={locked} />
          </div>
        </Card>

        <Card padding="lg">
          <div className="form">
            <h2 className="pform__h">Where</h2>
            <Select label="Workplace *" value={f.workplace} onValueChange={(v) => set("workplace", v as PostingInput["workplace"])} disabled={locked}>
              {WORKPLACES.map(([v, l]) => <Select.Item key={v} value={v}>{l}</Select.Item>)}
            </Select>
            {remote ? (
              <>
                <fieldset className="pform__regions">
                  <legend className="microlabel">Open to candidates in *</legend>
                  <div className="pform__checks">
                    {REGIONS.map((r) => (
                      <Checkbox key={r} label={r} checked={f.regions.includes(r)} disabled={locked} onCheckedChange={(c) => set("regions", c ? [...f.regions, r] : f.regions.filter((x) => x !== r))} />
                    ))}
                  </div>
                </fieldset>
                <TextField label="Time zone requirement" placeholder="US time zones, or within 3 hours of Pacific" value={f.location} onChange={(e) => set("location", e.target.value)} disabled={locked} description="Optional. Only if candidates must overlap certain hours." />
              </>
            ) : (
              <TextField label="Office location *" placeholder="Seattle, WA" value={f.location} onChange={(e) => set("location", e.target.value)} disabled={locked} description={f.workplace === "hybrid" ? "The office the hybrid days are in." : "City and state or country."} />
            )}
          </div>
        </Card>

        <Card padding="lg">
          <div className="form">
            <h2 className="pform__h">Pay</h2>
            <div className="form__row">
              <TextField label="From, a year *" inputMode="numeric" placeholder="180,000" leadingIcon={<span className="pform__cur">$</span>} value={withCommas(f.salaryMin)} onChange={(e) => set("salaryMin", digits(e.target.value))} disabled={locked} font="mono" />
              <TextField label="To, a year *" inputMode="numeric" placeholder="240,000" leadingIcon={<span className="pform__cur">$</span>} value={withCommas(f.salaryMax)} onChange={(e) => set("salaryMax", digits(e.target.value))} disabled={locked} font="mono" error={payBelowMin ? "Below the bottom of the range." : undefined} />
            </div>
            <p className="muted">Annual base pay in US dollars, both ends. Required: every TekJobs reader carries a pay floor, and a posting without a stated range scores below one with. Equity and bonus belong in the description.</p>
          </div>
        </Card>

        <Card padding="lg">
          <div className="form">
            <h2 className="pform__h">The work</h2>
            <Tabs defaultValue="write" variant="pill" size="sm">
              <Tabs.List aria-label="Write or preview the description">
                <Tabs.Trigger value="write">Write</Tabs.Trigger>
                <Tabs.Trigger value="preview">Preview</Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="write">
                <TextArea label="Description *" rows={16} font="mono" value={f.description} onChange={(e) => set("description", e.target.value)} disabled={locked} description="Markdown. What the team builds, the stack and systems, what the first quarter looks like, what you need from the person. A paragraph that says what the job is beats a list of buzzwords." />
              </Tabs.Content>
              <Tabs.Content value="preview">
                <div className="doc pform__preview"><Markdown text={f.description || "_Nothing written yet._"} /></div>
              </Tabs.Content>
            </Tabs>
            <TextField
              label="Matching terms"
              placeholder="design systems, react, typescript, figma, accessibility"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              disabled={locked}
              description="Optional, comma-separated, up to twenty. Each term must also appear in the title or description; a term that does not is dropped when you save, because unsupported terms do not improve a posting."
              error={unsupported.length ? `Not in the description yet: ${unsupported.join(", ")}` : undefined}
            />
          </div>
        </Card>

        <Card padding="lg">
          <div className="form">
            <h2 className="pform__h">How to apply</h2>
            <Select label="Candidates apply *" value={applyVia} onValueChange={(v) => setApplyVia(v as "website" | "email")} disabled={locked}>
              <Select.Item value="website">On your website</Select.Item>
              <Select.Item value="email">By email</Select.Item>
            </Select>
            {applyVia === "website"
              ? <TextField label="Application link *" placeholder="https://jobs.example.com/…" value={f.applyUrl} onChange={(e) => set("applyUrl", e.target.value)} disabled={locked} />
              : <TextField label="Application email *" type="email" placeholder="jobs@example.com" value={f.applyEmail} onChange={(e) => set("applyEmail", e.target.value)} disabled={locked} />}
            <p className="muted">Candidates apply to you directly. TekJobs is not in the middle and never sees who applied.</p>
          </div>
        </Card>

        {payError && (
          <div className="notice pform__errors" role="alert">
            <strong>Checkout could not be opened. Your draft is safe.</strong>
            <p className="muted">{payError}</p>
            <div className="hero__actions">
              <Button size="sm" tone="primary" onClick={pay} disabled={!!busy}>Try payment again</Button>
            </div>
          </div>
        )}

        <div className="form__actions">
          {status === "live" && <Button variant="ghost" tone="danger" size="sm" disabled={!!busy} loading={busy === "close"} onClick={close}>Close posting</Button>}
          {savedAt && <span className="muted pform__saved num">{status === "draft" ? "Draft saved" : "Saved"} {savedAt.slice(11, 16)} UTC</span>}
          <span className="spacer" />
          {!locked && <Button variant="soft" size="sm" disabled={!!busy} loading={busy === "save"} onClick={() => save("save")}>{busy === "save" ? "Saving draft…" : id ? "Save changes" : "Save draft"}</Button>}
          {status === "draft" && (
            purchasesOpen
              ? <Button tone="primary" size="sm" disabled={!!busy} loading={busy === "pay-save" || busy === "pay-open"} onClick={pay}>{payLabel}</Button>
              : <Badge tone="neutral" variant="outline">Payment opens soon; the draft keeps</Badge>
          )}
        </div>
        <p className="consent">Checkout is Stripe&apos;s; your card never reaches this site. By paying you agree to the <a href="/legal/terms#3-job-postings">posting rules</a> and the <a href="/legal/refunds">refund policy</a>. The posting runs 30 days from the day it goes live.</p>
      </div>

      <aside className="pform__aside">
        <span className="microlabel">On the board</span>
        <div className="jobrow jobrow--static">
          <span className="jobrow__company">{f.company || "Company"}{f.department ? ` · ${f.department}` : ""}</span>
          <span className="jobrow__title">{f.title || "Title"}</span>
          <span className="jobrow__meta num">
            <span className="jobrow__pay">{f.salaryMin && f.salaryMax ? `${money(f.salaryMin)}–${money(f.salaryMax)}` : "pay not stated"}</span>
            <span>{where}</span>
            <span>{f.employmentType}{f.seniority ? ` · ${f.seniority}` : ""}</span>
          </span>
        </div>
        <span className="microlabel">How TekJobs reads this post</span>
        <div className="pcard">
          <div className="pcard__reasons">
            <div><span>title terms</span><span className="num">{f.title.trim().length >= 3 ? "can match" : "empty"}</span></div>
            <div><span>description keywords</span><span className="num">{f.description.length >= 200 ? "can match" : `${f.description.length} of 200 chars`}</span></div>
            <div><span>pay floor</span><span className="num">{f.salaryMax ? `tops at ${money(f.salaryMax)}` : "unknown, scores below"}</span></div>
            <div><span>remote rule</span><span className="num">{remote ? "remote" : f.workplace}</span></div>
            <div><span>matching terms</span><span className="num">{tags.length ? `${tags.length - unsupported.length} of ${tags.length} supported` : "none"}</span></div>
          </div>
          <p className="muted pcard__note">Each reader&apos;s own criteria decide the points. This shows what your posting gives the score to work with.</p>
        </div>
      </aside>
    </div>
  );
}
