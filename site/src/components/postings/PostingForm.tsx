"use client";
import { Badge, Button, Card, Checkbox, Markdown, Select, Tabs, TextArea, TextField, toast } from "@/components/ui";
import { useMemo, useState } from "react";
import type { Posting, PostingInput } from "@/server/postings";

const WORKPLACES = [["remote", "Remote"], ["hybrid", "Hybrid"], ["onsite", "On-site"]] as const;
const REGIONS = ["Worldwide", "United States", "Canada", "Americas", "Europe", "United Kingdom", "Asia-Pacific", "Africa", "Middle East"];
const EMPLOYMENT = [["full-time", "Full-time"], ["part-time", "Part-time"], ["contract", "Contract"], ["internship", "Internship"]] as const;
const SENIORITY = [["", "Not stated"], ["junior", "Junior"], ["mid", "Mid"], ["senior", "Senior"], ["staff", "Staff"], ["principal", "Principal"], ["lead", "Lead"], ["director", "Director"]] as const;

const blank: PostingInput = { title: "", company: "", companyUrl: "", location: "", workplace: "remote", regions: ["United States"], employmentType: "full-time", seniority: "", department: "", salaryMin: 0, salaryMax: 0, currency: "USD", description: "", applyUrl: "", applyEmail: "", tags: [] };
const money = (n: number) => (n ? `$${Math.round(n / 1000)}k` : "");

/**
 * The posting form. Everything the scan scores on is a field here, in the order a reader meets it: what the
 * job is, where, what it pays, what the work is, how to apply. Saves as a draft; pays from the same page.
 * The preview on the right is the posting as a TekJobs user's Today page would show it.
 */
export function PostingForm({ posting, purchasesOpen }: { posting?: Posting; purchasesOpen: boolean }) {
  const [f, setF] = useState<PostingInput>(posting ? { ...blank, ...posting } : blank);
  const [id, setId] = useState(posting?.id ?? "");
  const [status] = useState(posting?.status ?? "draft");
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState<"" | "save" | "pay" | "close">("");
  const [tagsText, setTagsText] = useState((posting?.tags ?? []).join(", "));
  const set = <K extends keyof PostingInput>(k: K, v: PostingInput[K]) => setF((cur) => ({ ...cur, [k]: v }));
  const payload = useMemo(() => ({ ...f, tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean) }), [f, tagsText]);
  const locked = status === "closed" || status === "removed";

  const save = async (): Promise<string | null> => {
    setBusy("save");
    try {
      const r = await fetch(id ? `/api/postings/${encodeURIComponent(id)}` : "/api/postings", { method: id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = (await r.json()) as { posting?: Posting; error?: string; errors?: string[] };
      if (!r.ok) { setErrors(data.errors ?? [data.error ?? `Saving answered ${r.status}`]); toast({ title: "Not saved yet", description: data.errors ? `${data.errors.length} thing${data.errors.length === 1 ? "" : "s"} to fix, listed above the form.` : data.error, tone: "danger" }); return null; }
      setErrors([]);
      const saved = data.posting!;
      if (!id) { setId(saved.id); window.history.replaceState(null, "", `/app/post-a-job/${saved.id}`); }
      toast({ title: id ? "Saved" : "Draft saved", description: `${saved.title} at ${saved.company}.`, tone: "success" });
      return saved.id;
    } catch (e) { toast({ title: "Not saved", description: (e as Error).message, tone: "danger" }); return null; }
    finally { setBusy(""); }
  };
  const pay = async () => {
    const savedId = await save();
    if (!savedId) return;
    setBusy("pay");
    try {
      const r = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ postingId: savedId }) });
      const data = (await r.json()) as { url?: string; error?: string };
      if (!r.ok || !data.url) throw new Error(data.error || `Checkout answered ${r.status}`);
      window.location.assign(data.url);
    } catch (e) { toast({ title: "Could not start checkout", description: (e as Error).message, tone: "danger" }); setBusy(""); }
  };
  const close = async () => {
    if (!id || !window.confirm("Close this posting? It leaves the feed and cannot be reopened; a new posting is a new purchase.")) return;
    setBusy("close");
    try { const r = await fetch(`/api/postings/${encodeURIComponent(id)}`, { method: "DELETE" }); if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error || `Answered ${r.status}`); window.location.assign("/app/post-a-job"); }
    catch (e) { toast({ title: "Not closed", description: (e as Error).message, tone: "danger" }); setBusy(""); }
  };

  return (
    <div className="pform">
      <div className="pform__main">
        {errors.length > 0 && (
          <div className="notice pform__errors">
            <strong>Before this can be saved:</strong>
            <ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}
        <Card padding="lg">
          <div className="form">
            <h2 className="pform__h">The job</h2>
            <TextField label="Title *" placeholder="Senior Design Engineer" value={f.title} onChange={(e) => set("title", e.target.value)} disabled={locked} description="The real title. Readers' criteria match on it." />
            <div className="form__row">
              <TextField label="Company *" value={f.company} onChange={(e) => set("company", e.target.value)} disabled={locked} />
              <TextField label="Company website" placeholder="https://" value={f.companyUrl} onChange={(e) => set("companyUrl", e.target.value)} disabled={locked} />
            </div>
            <TextField label="Department or team" placeholder="Design Systems" value={f.department} onChange={(e) => set("department", e.target.value)} disabled={locked} />
            <div className="form__row">
              <Select label="Employment *" value={f.employmentType} onValueChange={(v) => set("employmentType", v as PostingInput["employmentType"])} disabled={locked}>
                {EMPLOYMENT.map(([v, l]) => <Select.Item key={v} value={v}>{l}</Select.Item>)}
              </Select>
              <Select label="Seniority" value={f.seniority || "none"} onValueChange={(v) => set("seniority", v === "none" ? "" : v)} disabled={locked}>
                {SENIORITY.map(([v, l]) => <Select.Item key={v || "none"} value={v || "none"}>{l}</Select.Item>)}
              </Select>
            </div>
          </div>
        </Card>
        <Card padding="lg">
          <div className="form">
            <h2 className="pform__h">Where</h2>
            <div className="form__row">
              <Select label="Workplace *" value={f.workplace} onValueChange={(v) => set("workplace", v as PostingInput["workplace"])} disabled={locked}>
                {WORKPLACES.map(([v, l]) => <Select.Item key={v} value={v}>{l}</Select.Item>)}
              </Select>
              <TextField label="Location *" placeholder={f.workplace === "remote" ? "US time zones, or the country" : "Seattle, WA"} value={f.location} onChange={(e) => set("location", e.target.value)} disabled={locked} description="For remote roles, the country or time zone that applies. Readers' criteria read this text." />
            </div>
            {f.workplace === "remote" && (
              <fieldset className="pform__regions">
                <legend className="microlabel">Open to applicants in *</legend>
                <div className="pform__checks">
                  {REGIONS.map((r) => (
                    <Checkbox key={r} label={r} checked={f.regions.includes(r)} disabled={locked} onCheckedChange={(c) => set("regions", c ? [...f.regions, r] : f.regions.filter((x) => x !== r))} />
                  ))}
                </div>
              </fieldset>
            )}
          </div>
        </Card>
        <Card padding="lg">
          <div className="form">
            <h2 className="pform__h">Pay</h2>
            <div className="form__row">
              <TextField label="From, USD a year *" inputMode="numeric" placeholder="180000" value={f.salaryMin ? String(f.salaryMin) : ""} onChange={(e) => set("salaryMin", Number(e.target.value.replace(/[^0-9]/g, "")) || 0)} disabled={locked} font="mono" />
              <TextField label="To, USD a year *" inputMode="numeric" placeholder="240000" value={f.salaryMax ? String(f.salaryMax) : ""} onChange={(e) => set("salaryMax", Number(e.target.value.replace(/[^0-9]/g, "")) || 0)} disabled={locked} font="mono" />
            </div>
            <p className="muted">Required. Every TekJobs reader's criteria carry a pay floor; a posting without a stated range scores below one with. Base pay, not total compensation.</p>
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
                <TextArea label="Description *" rows={16} font="mono" value={f.description} onChange={(e) => set("description", e.target.value)} disabled={locked} description="Markdown. What the team builds, the stack and systems, what the first quarter looks like, what you need. Keywords in this text are what readers' criteria score; a list of buzzwords scores worse than a paragraph that says what the job is." />
              </Tabs.Content>
              <Tabs.Content value="preview">
                <div className="doc pform__preview"><Markdown text={f.description || "_Nothing written yet._"} /></div>
              </Tabs.Content>
            </Tabs>
            <TextField label="Keywords" placeholder="design systems, react, typescript, figma, accessibility" value={tagsText} onChange={(e) => setTagsText(e.target.value)} disabled={locked} description="Comma-separated. Up to twenty; they are matched like words in the description." />
          </div>
        </Card>
        <Card padding="lg">
          <div className="form">
            <h2 className="pform__h">How to apply</h2>
            <div className="form__row">
              <TextField label="Apply link" placeholder="https://jobs.example.com/…" value={f.applyUrl} onChange={(e) => set("applyUrl", e.target.value)} disabled={locked} />
              <TextField label="or apply email" type="email" placeholder="jobs@example.com" value={f.applyEmail} onChange={(e) => set("applyEmail", e.target.value)} disabled={locked} />
            </div>
            <p className="muted">One of the two. Readers apply to you directly; we are not in the middle and never see who applied.</p>
          </div>
        </Card>
        <div className="form__actions">
          {status === "live" && <Button variant="ghost" tone="danger" size="sm" disabled={!!busy} loading={busy === "close"} onClick={close}>Close posting</Button>}
          <span className="spacer" />
          {!locked && <Button variant="soft" size="sm" disabled={!!busy} loading={busy === "save"} onClick={save}>{id ? "Save changes" : "Save draft"}</Button>}
          {status === "draft" && (
            purchasesOpen
              ? <Button tone="primary" size="sm" disabled={!!busy} loading={busy === "pay"} onClick={pay}>Save and pay $49</Button>
              : <Badge tone="neutral" variant="outline">Payment opens soon; the draft keeps</Badge>
          )}
        </div>
        <p className="consent">By paying you agree to the <a href="/legal/terms#3-job-postings">posting rules</a> and the <a href="/legal/refunds">refund policy</a>. The posting runs 30 days from the day it goes live.</p>
      </div>

      <aside className="pform__aside">
        <span className="microlabel">How a reader sees it</span>
        <div className="pcard">
          <div className="pcard__company">{f.company || "Company"}{f.department ? ` · ${f.department}` : ""}</div>
          <div className="pcard__title">{f.title || "Title"}</div>
          <div className="pcard__meta num">
            <span>{f.salaryMin && f.salaryMax ? `${money(f.salaryMin)}–${money(f.salaryMax)}` : "pay not stated"}</span>
            <span>{f.workplace === "remote" ? `remote · ${f.regions.join(", ") || "where?"}` : f.workplace}</span>
            <span>{f.location || "location"}</span>
          </div>
          <div className="pcard__reasons">
            <div><span>title match</span><span className="num">{f.title ? "+" : "·"}</span></div>
            <div><span>description keywords</span><span className="num">{f.description.length >= 200 ? "+" : "·"}</span></div>
            <div><span>pay at or above the reader&apos;s floor</span><span className="num">{f.salaryMax ? "+" : "−"}</span></div>
            <div><span>remote</span><span className="num">{f.workplace === "remote" ? "+" : "−"}</span></div>
          </div>
          <p className="muted pcard__note">Each reader&apos;s criteria decide the numbers; this shows which lines your posting can earn at all.</p>
        </div>
      </aside>
    </div>
  );
}
