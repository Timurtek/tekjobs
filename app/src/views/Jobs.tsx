import { Badge, Button, Card, Combobox, Dialog, Icon, Markdown, Menu, Popover, Select, Sheet, Skeleton, Switch, Table, Tabs, TextArea, TextField, toast } from "@/components/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { CoverLetter } from "./CoverLetter";
import { JobPeople } from "./People";
import { TailoredResume } from "./TailoredResume";
import { api, BAND_LABEL, BAND_TONE, daysAgo, money, PASS_REASONS, shortPay, STATUS_TONE, STATUSES, type Facets, type ImportResult, type Job, type JobQuery, type JobRow, type Kind, type Packet, type PassReason, type PayBand, type SavedView, type Status } from "../api";

/** Paste links to postings found elsewhere (LinkedIn, a newsletter); each is read once and added as a note unless one exists. */
function AddByLink({ onAdded, onOpen }: { onAdded: (id: string | null) => void; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const urls = text.split(/\s+/).map((s) => s.trim()).filter((s) => /^https?:\/\//i.test(s));

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.importLinks(urls);
      setResults(r);
      const added = r.filter((x) => x.added);
      if (added.length) {
        toast({ title: `${added.length} job${added.length === 1 ? "" : "s"} added`, description: added.map((x) => `${x.company}: ${x.title}`).join(" · "), tone: "success" });
        onAdded(added[0]?.id ?? null);
      } else toast({ title: "Nothing new", description: "Every link was already here, or could not be read.", tone: "warning" });
    } catch (e) {
      toast({ title: "Import failed", description: (e as Error).message, tone: "danger" });
    } finally {
      setBusy(false);
    }
  };
  const reset = (o: boolean) => { setOpen(o); if (!o) { setText(""); setResults(null); } };

  return (
    <Dialog open={open} onOpenChange={reset} size="md">
      <Dialog.Trigger asChild>
        <Button size="sm" variant="soft" leadingIcon={<Icon.Plus />}>Add by link</Button>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>Add postings by link</Dialog.Title>
        <Dialog.Description>
          One link per line. LinkedIn job pages, company careers pages, and Greenhouse, Lever or Ashby postings. Each is read once, scored like the scan does, and written as a note unless it is already here.
        </Dialog.Description>
        <TextArea label="Links" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={"https://www.linkedin.com/jobs/view/…\nhttps://jobs.lever.co/…"} disabled={busy} />
        {results && (
          <ul className="import-results">
            {results.map((r, i) => (
              <li key={i}>
                <Badge size="sm" tone={r.ok ? (r.added ? "success" : "neutral") : "danger"}>{r.ok ? (r.added ? "added" : "already here") : "failed"}</Badge>
                {r.ok ? (
                  <span className="import-results__row">
                    <span>{r.score} ·</span>
                    {r.id ? (
                      <Button variant="link" size="sm" tone="primary" onClick={() => { setOpen(false); onOpen(r.id!); }}>{r.company} — {r.title}</Button>
                    ) : (
                      <span>{r.company} — {r.title}</span>
                    )}
                    {r.link && (
                      <Button asChild variant="link" size="sm" tone="neutral" trailingIcon={<Icon.ExternalLink />}>
                        <a href={r.link} target="_blank" rel="noopener noreferrer">Open posting</a>
                      </Button>
                    )}
                    {r.reason && <span className="muted">({r.reason})</span>}
                    {r.belowMin && <span className="muted">· below the scan's minimum, written anyway</span>}
                  </span>
                ) : (
                  <span>{r.error} ({r.url})</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <Dialog.Footer>
          <Dialog.Close asChild><Button variant="ghost" size="sm" disabled={busy}>Close</Button></Dialog.Close>
          <Button size="sm" tone="primary" disabled={busy || urls.length === 0} loading={busy} onClick={submit}>{busy ? "Reading…" : `Add ${urls.length || ""}`.trim()}</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}

/** For a note that has no real posting (created from an email, or a thin page): read the posting and fill the note from it. */
function AttachPosting({ job, onAttached }: { job: Job; onAttached: (j: Job) => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const thin = job.source === "mail" || job.source === "page" || !job.url || /mail\.google\.com/.test(job.url);
  const submit = async () => {
    setBusy(true);
    try { const j = await api.attachPosting(job.id, url.trim()); onAttached(j); setOpen(false); setUrl(""); toast({ title: `${j.company}: posting attached`, description: `Scored ${j.score} from the posting. Status, notes and drafts kept.`, tone: "success" }); }
    catch (e) { toast({ title: "Could not attach", description: (e as Error).message, tone: "danger" }); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen} size="sm">
      <Dialog.Trigger asChild>
        <Button variant={thin ? "soft" : "ghost"} size="sm" leadingIcon={<Icon.Link />}>{thin ? "Attach posting" : "Replace posting"}</Button>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>{thin ? "Attach the posting" : "Replace the posting"}</Dialog.Title>
        <Dialog.Description>
          {thin ? "This note was created without the posting itself. " : ""}Paste the job's link. The posting's facts, score and description replace the note's; status, notes, packet and drafts stay. The note keeps its name.
        </Dialog.Description>
        <TextField label="Posting link" placeholder="https://jobs.ashbyhq.com/… or the company careers page" value={url} onChange={(e) => setUrl(e.target.value)} disabled={busy} />
        <Dialog.Footer>
          <Dialog.Close asChild><Button variant="ghost" size="sm" disabled={busy}>Cancel</Button></Dialog.Close>
          <Button size="sm" tone="primary" disabled={busy || !/^https?:\/\//i.test(url.trim())} loading={busy} onClick={submit}>Attach</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}

const PAGE_SIZE = 25;
const DAY_OPTIONS: [string, string][] = [["", "any time"], ["2", "2 days"], ["7", "7 days"], ["14", "14 days"], ["30", "30 days"], ["90", "90 days"]];

/** Every filter on the view. Lists are arrays; numbers stay strings while they are being typed. */
interface Filters { q: string; location: string; remote: boolean; kind: string; band: string[]; status: string[]; source: string[]; company: string[]; minScore: string; maxScore: string; payMin: string; payMax: string; payKnown: boolean; postedDays: string; foundDays: string }
const DEFAULTS: Filters = { q: "", location: "", remote: false, kind: "all", band: [], status: [], source: [], company: [], minScore: "45", maxScore: "", payMin: "", payMax: "", payKnown: false, postedDays: "", foundDays: "" };
const hashParams = () => new URLSearchParams(window.location.hash.split("?")[1] ?? "");

/** The filter dimensions that can become chips, in the order they appear. Search is its own field. */
type DimKey = Exclude<keyof Filters, "q">;
const DIMS: { key: DimKey; label: string }[] = [
  { key: "minScore", label: "Score at least" }, { key: "remote", label: "Remote only" }, { key: "location", label: "Location" }, { key: "kind", label: "Title" },
  { key: "band", label: "Pay band" }, { key: "status", label: "Status" }, { key: "source", label: "Source" }, { key: "company", label: "Company" },
  { key: "payMin", label: "Pay at least" }, { key: "payMax", label: "Pay at most" }, { key: "payKnown", label: "Stated pay only" },
  { key: "postedDays", label: "Posted within" }, { key: "foundDays", label: "Found within" }, { key: "maxScore", label: "Score at most" },
];
/** A dimension is active when it narrows the list; the score floor counts whenever it is above zero. */
const isActive = (f: Filters, key: DimKey) => {
  const v = f[key];
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "boolean") return v;
  if (key === "minScore") return v !== "" && v !== "0";
  return v !== DEFAULTS[key];
};

/** Filters live in the hash (#/jobs?status=applied,applying&payMin=200000), so a filtered view is a link you can keep or send. */
function readFilters(from?: string): Filters {
  const qs = from !== undefined ? new URLSearchParams(from) : hashParams();
  const f = { ...DEFAULTS, band: [] as string[], status: [] as string[], source: [] as string[], company: [] as string[] };
  const bag = f as unknown as Record<string, unknown>;
  for (const k of Object.keys(DEFAULTS) as (keyof Filters)[]) {
    const v = qs.get(k);
    if (v === null) continue;
    const d = DEFAULTS[k];
    bag[k] = Array.isArray(d) ? v.split(",").filter(Boolean) : typeof d === "boolean" ? v === "1" : v;
  }
  return f;
}
/** The query string for a filter set: only what differs from the defaults, so a plain view is a plain link. */
function paramsFor(f: Filters, sort: string, dir: string): string {
  const qs = new URLSearchParams();
  for (const k of Object.keys(DEFAULTS) as (keyof Filters)[]) {
    const v = f[k];
    if (Array.isArray(v)) { if (v.length) qs.set(k, v.join(",")); }
    else if (typeof v === "boolean") { if (v) qs.set(k, "1"); }
    else if (v !== DEFAULTS[k]) qs.set(k, v);
  }
  if (sort !== "score") qs.set("sort", sort);
  if (dir !== "desc") qs.set("dir", dir);
  return qs.toString();
}
function writeFilters(f: Filters, sort: string, dir: string) {
  const s = paramsFor(f, sort, dir);
  window.history.replaceState(null, "", `#/jobs${s ? `?${s}` : ""}`);
}
const toQuery = (f: Filters): JobQuery => ({
  q: f.q, location: f.location, remote: f.remote ? 1 : undefined, kind: f.kind === "all" ? undefined : (f.kind as Kind),
  band: f.band.join(","), status: f.status.join(","), source: f.source.join(","), company: f.company.join(","),
  // "any" sends no floor at all, so notes with a negative score (created from an email or a link) show too.
  minScore: f.minScore === "0" || f.minScore === "" ? undefined : Number(f.minScore), maxScore: f.maxScore ? Number(f.maxScore) : undefined,
  payMin: f.payMin ? Number(f.payMin) : undefined, payMax: f.payMax ? Number(f.payMax) : undefined, payKnown: f.payKnown ? 1 : undefined,
  postedDays: f.postedDays ? Number(f.postedDays) : undefined, foundDays: f.foundDays ? Number(f.foundDays) : undefined,
});
const withCount = (values: string[], counts: Record<string, number> | undefined, label: (v: string) => string) =>
  values.map((v) => ({ value: v, label: label(v), hint: counts ? String(counts[v] ?? 0) : undefined }));

/**
 * The last filter set this browser used, so coming back to Jobs picks up where it left off. A hash with its
 * own query (a pasted link, a view chip, the top search) always wins; a bare #/jobs restores the last one.
 */
const LAST_KEY = "tekjobs.jobs.last";
const rememberLast = (qs: string) => { try { localStorage.setItem(LAST_KEY, qs); } catch { /* fine */ } };
const restoreLastIntoHash = () => {
  const [p, q] = window.location.hash.replace(/^#\/?/, "").split("?");
  if (p !== "jobs" || q) return;
  let last = ""; try { last = localStorage.getItem(LAST_KEY) ?? ""; } catch { /* fine */ }
  if (last) window.history.replaceState(null, "", `#/jobs?${last}`);
};

export function Jobs({ initialQuery = "" }: { initialQuery?: string }) {
  if (!initialQuery) restoreLastIntoHash();
  const [f, setF] = useState<Filters>(() => { const r = readFilters(); return initialQuery ? { ...r, q: initialQuery } : r; });
  const [sort, setSort] = useState<keyof JobRow>(() => (hashParams().get("sort") as keyof JobRow | null) || "score");
  const [dir, setDir] = useState<"asc" | "desc">(() => (hashParams().get("dir") === "asc" ? "asc" : "desc"));
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<JobRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [allTotal, setAllTotal] = useState<number | null>(null);
  const [openKey, setOpenKey] = useState<DimKey | null>(null);
  // A dimension picked from the "+ Filter" menu opens its editor at once, and the menu is told not to hand focus
  // back to its trigger when it finishes closing. Without that, the menu's exit (a moment later, after its
  // animation) moved focus out of the freshly opened popover, which closed on focus-outside, and the chip
  // (shown only while active or open) vanished with it: "it disappears right away".
  const pendingDim = useRef<DimKey | null>(null);
  // A dimension the person added but has not filled in yet keeps its chip, editor open or not, until its ×.
  const [added, setAdded] = useState<DimKey[]>([]);
  const [views, setViews] = useState<SavedView[]>([]);
  const [defaults, setDefaults] = useState<(SavedView & { hint: string })[]>([]);
  const [viewName, setViewName] = useState<string | null>(null);
  // Condensed folds the views row and the filter chips away and leaves the one-line summary, with a button to
  // bring them back; the choice is this browser's own. The table's density does not change.
  const [condensed, setCondensed] = useState(() => { try { return localStorage.getItem("tekjobs.jobs.condensed") === "1"; } catch { return false; } });
  const toggleCondensed = () => setCondensed((d) => { try { localStorage.setItem("tekjobs.jobs.condensed", d ? "0" : "1"); } catch { /* fine */ } return !d; });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    api.views().then(setViews).catch(() => {});
    api.defaultViews().then(setDefaults).catch(() => {});
    api.facets({}).then((x) => setAllTotal(x.total)).catch(() => {});
    // The score floor's default is the criteria's own bar, not a number written into the app.
    api.summary().then((s) => {
      if (!s.minScore) return;
      const bar = String(s.minScore);
      const had = hashParams().has("minScore");
      DEFAULTS.minScore = bar;
      if (!had) setF((cur) => (cur.minScore === "45" || cur.minScore === "" ? { ...cur, minScore: bar } : cur));
    }).catch(() => {});
  }, []);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => { setF((cur) => ({ ...cur, [k]: v })); setPage(0); };
  const query = useMemo(() => toQuery(f), [f]);
  const queryKey = JSON.stringify(query);
  const remoteOnly = f.remote;

  useEffect(() => { if (initialQuery) set("q", initialQuery); }, [initialQuery]);
  useEffect(() => { writeFilters(f, sort, dir); rememberLast(paramsFor(f, sort, dir)); }, [f, sort, dir]);
  // The sidebar's Jobs link, a view chip elsewhere, or a pasted link change the hash from outside: follow it.
  // Our own writes use replaceState and fire no event, so this only ever reacts to someone else's navigation.
  // A bare #/jobs (the sidebar link) means "the last set I was using", not "nothing".
  useEffect(() => {
    const on = () => {
      if (window.location.hash.replace(/^#\/?/, "").split("?")[0] !== "jobs") return;
      restoreLastIntoHash();
      const next = readFilters();
      const nextSort = (hashParams().get("sort") as keyof JobRow | null) || "score";
      const nextDir = hashParams().get("dir") === "asc" ? "asc" : "desc";
      if (paramsFor(next, nextSort, nextDir) === paramsFor(f, sort, dir)) return;
      setF(next); setSort(nextSort); setDir(nextDir); setPage(0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, [f, sort, dir]);
  useEffect(() => {
    let live = true;
    api
      .jobs({ ...query, sort, dir, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then((r) => { if (live) { setRows(r.rows); setTotal(r.total); } })
      .catch((e: Error) => toast({ title: "Could not load jobs", description: e.message, tone: "danger" }));
    api.facets(query).then((x) => { if (live) setFacets(x); }).catch(() => {});
    return () => { live = false; };
  }, [queryKey, sort, dir, page, reload]);

  // Picker options come from the facets, so every choice shows what it would leave; a value that is selected
  // but currently counts zero stays visible so it can be removed.
  const statusOptions = withCount(STATUSES, facets?.status, (s) => s);
  const bandOptions = withCount(["floor", "stretch", "below", "unknown"], facets?.band, (b) => BAND_LABEL[b as PayBand]);
  const sourceValues = Array.from(new Set([...(facets?.source.link ? ["link"] : []), ...Object.entries(facets?.source ?? {}).filter(([k]) => k !== "link").sort((a, b) => b[1] - a[1]).map(([k]) => k), ...f.source]));
  const sourceOptions = withCount(sourceValues, facets?.source, (s) => (s === "link" ? "added by link" : s));
  const companyValues = Array.from(new Set([...f.company, ...Object.entries(facets?.company ?? {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c)]));
  const companyOptions = withCount(companyValues, facets?.company, (c) => c);
  const pay = facets?.pay;

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const sortBy = (k: keyof JobRow) => {
    if (sort === k) setDir(dir === "desc" ? "asc" : "desc");
    else { setSort(k); setDir(k === "company" || k === "title" ? "asc" : "desc"); }
    setPage(0);
  };
  const head = (k: keyof JobRow, label: string, extra?: { align?: "end"; numeric?: boolean }) => (
    <Table.HeadCell {...extra} aria-sort={sort === k ? (dir === "desc" ? "descending" : "ascending") : undefined}>
      <Button variant="link" size="sm" tone="neutral" onClick={() => sortBy(k)} trailingIcon={sort === k ? (dir === "desc" ? <Icon.ArrowDown /> : <Icon.ArrowUp />) : undefined}>
        <span className="col">{label}</span>
      </Button>
    </Table.HeadCell>
  );

  const onChanged = (job: Job) => setRows((rs) => (rs ? rs.map((r) => (r.id === job.id ? { ...r, status: job.status } : r)) : rs));

  // The editor inside a chip's popover, per dimension.
  const editorFor = (key: DimKey) => {
    switch (key) {
      case "location": return <TextField size="sm" label="Location" description="Comma-separated, any of; whole words." placeholder="seattle, wa, united states" value={f.location} onChange={(e) => set("location", e.target.value)} autoFocus />;
      case "remote": return <Switch size="sm" label={`Remote only${facets ? ` (${facets.remote.remote})` : ""}`} checked={f.remote} onCheckedChange={(v) => set("remote", v === true)} />;
      case "payKnown": return <Switch size="sm" label="Stated pay only" checked={f.payKnown} onCheckedChange={(v) => set("payKnown", v === true)} />;
      case "kind": return (
        <Select size="sm" label="Title" value={f.kind} onValueChange={(v) => set("kind", v)}>
          <Select.Item value="all">All titles</Select.Item>
          <Select.Item value="design-eng">Design engineering{facets ? ` (${facets.kind["design-eng"] ?? 0})` : ""}</Select.Item>
          <Select.Item value="adjacent">Adjacent{facets ? ` (${facets.kind.adjacent ?? 0})` : ""}</Select.Item>
        </Select>
      );
      case "band": return <Combobox size="sm" multiple label="Pay band" placeholder="All bands" emptyMessage="No band by that name." options={bandOptions} value={f.band} onValueChange={(v) => set("band", v)} />;
      case "status": return <Combobox size="sm" multiple label="Status" placeholder="All statuses" emptyMessage="No status by that name." options={statusOptions} value={f.status} onValueChange={(v) => set("status", v)} />;
      case "source": return <Combobox size="sm" multiple label="Source" placeholder="All sources" emptyMessage="No source by that name." options={sourceOptions} value={f.source} onValueChange={(v) => set("source", v)} />;
      case "company": return <Combobox size="sm" multiple label="Company" placeholder="Any company" emptyMessage="No company in the current results by that name." options={companyOptions} value={f.company} onValueChange={(v) => set("company", v)} />;
      case "payMin": return <TextField size="sm" type="number" step={10000} label="Pay at least" description={pay ? `Top of the stated range. Stated on ${pay.stated} of ${pay.stated + pay.unstated}.` : undefined} placeholder="200000" value={f.payMin} onChange={(e) => set("payMin", e.target.value)} autoFocus />;
      case "payMax": return <TextField size="sm" type="number" step={10000} label="Pay at most" description={pay && pay.stated ? `${money(pay.min)} to ${money(pay.max)}, median ${money(pay.median)}.` : undefined} placeholder="300000" value={f.payMax} onChange={(e) => set("payMax", e.target.value)} autoFocus />;
      case "minScore": return (
        <Select size="sm" label="Score at least" value={f.minScore || "0"} onValueChange={(v) => set("minScore", v)}>
          {["0", "45", "60", "75", "90", "100"].map((n) => (
            <Select.Item key={n} value={n}>{n === "0" ? "any" : `${n} pts`}</Select.Item>
          ))}
        </Select>
      );
      case "maxScore": return <TextField size="sm" type="number" label="Score at most" placeholder="any" value={f.maxScore} onChange={(e) => set("maxScore", e.target.value)} autoFocus />;
      case "postedDays":
      case "foundDays": return (
        <Select size="sm" label={key === "postedDays" ? "Posted within" : "Found within"} value={f[key]} onValueChange={(v) => set(key, v)}>
          {DAY_OPTIONS.map(([v, l]) => (
            <Select.Item key={v || "any"} value={v}>{l}</Select.Item>
          ))}
        </Select>
      );
    }
  };
  const valueOf = (key: DimKey): string => {
    const v = f[key];
    if (Array.isArray(v)) return key === "band" ? v.map((b) => BAND_LABEL[b as PayBand]).join(", ") : v.length > 2 ? `${v.slice(0, 2).join(", ")} +${v.length - 2}` : v.join(", ");
    if (typeof v === "boolean") return "";
    if (key === "kind") return v === "design-eng" ? "design engineering" : v === "adjacent" ? "adjacent" : "";
    if (key === "payMin" || key === "payMax") return v ? money(Number(v)) : "";
    if (key === "minScore" || key === "maxScore") return v && v !== "0" ? `${v} pts` : "";
    if (key === "postedDays" || key === "foundDays") return v ? `${v} days` : "";
    return v;
  };
  const clearDim = (key: DimKey) => { const d = DEFAULTS[key]; set(key, (key === "minScore" ? "0" : Array.isArray(d) ? [] : d) as Filters[DimKey]); setOpenKey(null); setAdded((a) => a.filter((k) => k !== key)); };
  const addDim = (key: DimKey) => {
    // Switches turn on when picked; everything else opens its editor with an empty value.
    if (key === "remote" || key === "payKnown") set(key, true);
    else if (key === "kind") set(key, "design-eng");
    else if (key === "postedDays") set(key, "7");
    else if (key === "minScore" && (!f.minScore || f.minScore === "0")) set(key, "45");
    setAdded((a) => (a.includes(key) ? a : [...a, key]));
    setOpenKey(key);
  };
  const shown = DIMS.filter((d) => isActive(f, d.key) || openKey === d.key || added.includes(d.key));
  const addable = DIMS.filter((d) => !isActive(f, d.key) && !added.includes(d.key));
  const qs = paramsFor(f, sort, dir);
  const applyView = (v: SavedView) => { setF(readFilters(v.query)); setPage(0); };
  const saveView = async () => {
    const name = (viewName ?? "").trim();
    if (!name) return;
    try { setViews(await api.saveViews([...views.filter((v) => v.name !== name), { name, query: qs }])); setViewName(null); toast({ title: `View "${name}" saved`, description: "Targets/Job Views.md", tone: "success" }); }
    catch (e) { toast({ title: "Not saved", description: (e as Error).message, tone: "danger" }); }
  };
  const removeView = async (name: string) => {
    try { setViews(await api.saveViews(views.filter((v) => v.name !== name))); }
    catch (e) { toast({ title: "Not removed", description: (e as Error).message, tone: "danger" }); }
  };

  return (
    <>
      {!condensed && (<div className="views">
        <span className="views__label">Views</span>
        {defaults.map((v) => (
          <div key={`d:${v.name}`} className={`chip chip--default${v.query === qs ? " chip--current" : ""}`}>
            <Button size="sm" variant="ghost" tone={v.query === qs ? "primary" : "neutral"} title={`From your criteria: ${v.hint}`} onClick={() => applyView(v)}>{v.name}</Button>
          </div>
        ))}
        {views.map((v) => (
          <div key={v.name} className={`chip${v.query === qs ? " chip--current" : ""}`}>
            <Button size="sm" variant="ghost" tone={v.query === qs ? "primary" : "neutral"} onClick={() => applyView(v)}>{v.name}</Button>
            <Button size="sm" variant="ghost" tone="neutral" aria-label={`Remove the view ${v.name}`} onClick={() => removeView(v.name)}>×</Button>
          </div>
        ))}
        <Button size="sm" variant="ghost" tone="neutral" leadingIcon={<Icon.Plus />} disabled={!qs} onClick={() => setViewName("")}>Save current filters as a view</Button>
        <div className="toolbar__spacer" />
        <Button size="sm" variant="ghost" tone="neutral" leadingIcon={<Icon.ChevronUp />} onClick={toggleCondensed}>Condense</Button>
      </div>)}

      {!condensed && (<div className="filters">
        <TextField className="filters__search" size="sm" label="Search" placeholder="company or role" value={f.q} onChange={(e) => set("q", e.target.value)} />
        {shown.map((d) => {
          const on = isActive(f, d.key);
          const value = valueOf(d.key);
          return (
            <div key={d.key} className={`chip${on ? " chip--on" : ""}`}>
              <Popover open={openKey === d.key} onOpenChange={(o) => setOpenKey(o ? d.key : null)} size="sm">
                <Popover.Trigger asChild>
                  <Button size="sm" variant="ghost" tone="neutral" leadingIcon={<span className="chip__dot" aria-hidden="true" />}>
                    {d.label}
                    {value && <span className="chip__value num">{value}</span>}
                  </Button>
                </Popover.Trigger>
                <Popover.Content align="start" showArrow={false}>
                  <div className="chip__editor">{editorFor(d.key)}</div>
                </Popover.Content>
              </Popover>
              <Button size="sm" variant="ghost" tone="neutral" aria-label={`Remove ${d.label}`} onClick={() => clearDim(d.key)}>×</Button>
            </div>
          );
        })}
        {addable.length > 0 && (
          <Menu>
            <Menu.Trigger asChild>
              <Button size="sm" variant="ghost" tone="neutral" leadingIcon={<Icon.Plus />} trailingIcon={<Icon.ChevronDown />}>Filter</Button>
            </Menu.Trigger>
            <Menu.Content align="start" onCloseAutoFocus={(e) => { if (!pendingDim.current) return; pendingDim.current = null; e.preventDefault(); }}>
              {addable.map((d) => (
                <Menu.Item key={d.key} onSelect={() => { pendingDim.current = d.key; addDim(d.key); }}>{d.label}</Menu.Item>
              ))}
            </Menu.Content>
          </Menu>
        )}
        {shown.some((d) => isActive(f, d.key) && d.key !== "minScore") || f.q ? (
          <Button size="sm" variant="ghost" tone="neutral" onClick={() => { setF({ ...DEFAULTS, band: [], status: [], source: [], company: [] }); setPage(0); }}>Clear</Button>
        ) : null}
        <div className="toolbar__spacer" />
        <AddByLink onAdded={(id) => { setReload((n) => n + 1); if (id) setSelectedId(id); }} onOpen={(id) => setSelectedId(id)} />
      </div>)}

      <div className="filters__summary">
        <span>
          {condensed && (
            <Button size="sm" variant="soft" tone="neutral" leadingIcon={<Icon.ChevronDown />} onClick={toggleCondensed}>
              Filters{shown.filter((d) => isActive(f, d.key)).length + (f.q ? 1 : 0) > 0 ? <span className="num"> · {shown.filter((d) => isActive(f, d.key)).length + (f.q ? 1 : 0)}</span> : null}
            </Button>
          )}
          <b className="num">{total}</b> of <span className="num">{allTotal ?? "…"}</span> matches
          {pay && pay.stated > 0 && <> · pay stated on <span className="num">{pay.stated}</span>, median top of range <span className="num">{money(pay.median)}</span></>}
        </span>
        <span className="num filters__query">/jobs{qs ? `?${qs}` : ""}</span>
      </div>

      <Dialog open={viewName !== null} onOpenChange={(o) => !o && setViewName(null)} size="sm">
        <Dialog.Content>
          <Dialog.Title>Save these filters as a view</Dialog.Title>
          <Dialog.Description>A named link to exactly this filter set, kept in Targets/Job Views.md. Same name replaces the old one.</Dialog.Description>
          <TextField label="Name" placeholder="Design eng at floor" value={viewName ?? ""} onChange={(e) => setViewName(e.target.value)} autoFocus />
          <p className="muted num filters__query">/jobs?{qs}</p>
          <Dialog.Footer>
            <Dialog.Close asChild><Button variant="ghost" size="sm">Cancel</Button></Dialog.Close>
            <Button size="sm" tone="primary" disabled={!viewName?.trim()} onClick={saveView}>Save view</Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>

      <Card padding="none">
        <div className="jobs-narrow">
        {rows === null ? (
          <div className="loading"><Skeleton lines={8} /></div>
        ) : (
          <Table aria-label="Job matches" density="md" stickyHeader>
            <Table.Head>
              <Table.Row>
                {head("score", "Score", { align: "end", numeric: true })}
                {head("company", "Company")}
                {head("title", "Role")}
                {head("salaryMax", "Pay")}
                <Table.HeadCell>Location</Table.HeadCell>
                {head("posted", "Posted")}
                <Table.HeadCell>Status</Table.HeadCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {rows.map((r) => (
                <Table.Row key={r.id} interactive selected={selectedId === r.id} onClick={() => setSelectedId(r.id)}>
                  <Table.Cell align="end" numeric><span className="num">{r.score}</span></Table.Cell>
                  <Table.Cell>{r.company}</Table.Cell>
                  <Table.Cell>
                    <div className="who__text">
                      {r.title}
                      {r.kind === "design-eng" && <small>design engineering</small>}
                      {r.addedBy === "link" && <small>added by link</small>}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge tone={BAND_TONE[r.payBand]} variant={r.payBand === "floor" ? "solid" : "soft"} size="sm">
                      {r.salaryMax ? shortPay(r.salary) : BAND_LABEL[r.payBand]}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="where">
                      <Badge tone={r.remote ? "success" : "neutral"} variant="soft" size="sm">{r.remote ? "remote" : "on-site"}</Badge>
                      <span className="clamp">{r.location}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell><span className="muted num">{daysAgo(r.posted) || "—"}</span></Table.Cell>
                  <Table.Cell>
                    <Badge tone={STATUS_TONE[r.status]} size="sm">{r.status}</Badge>
                  </Table.Cell>
                </Table.Row>
              ))}
              {rows.length === 0 && (
                <Table.Row>
                  <Table.Cell colSpan={7}><span className="muted">Nothing matches these filters. Loosen one.</span></Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        )}
        </div>
      </Card>

      <div className="pager">
        <span>
          {total} match{total === 1 ? "" : "es"}, page {current + 1} of {pages}
          {remoteOnly && <span className="muted"> · on-site and hybrid hidden</span>}
        </span>
        <div className="pager__buttons">
          <Button variant="soft" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</Button>
          <Button variant="soft" size="sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</Button>
        </div>
      </div>

      <JobSheet id={selectedId} onClose={() => setSelectedId(null)} onChanged={onChanged} />
    </>
  );
}

/** The job note, opened beside the table. Status and notes write back to the markdown file. */
/** The "Why it matched" lines ("- title +40: design engineer", "- not remote -60") as label, detail and points. */
export function parseReasons(why: string): { label: string; detail: string; points: number }[] {
  return why.split("\n").map((l) => l.replace(/^-\s*/, "").trim()).filter(Boolean).map((line) => {
    // A line can carry more than one signed term ("+10, +3 for 30k above"); the row shows their sum.
    const points = [...line.matchAll(/(?<![\w$])([+-]\d+)\b/g)].reduce((sum, m) => sum + Number(m[1]), 0);
    const text = line.replace(/(?<![\w$])[+-]\d+\b/g, "").replace(/\(\s*[,\s]*/g, "(").replace(/[,\s]*\)/g, ")").replace(/\(\)/g, "").replace(/\s+,/g, ",").replace(/\s{2,}/g, " ").replace(/\s+:/g, ":").trim();
    const i = text.indexOf(":");
    const label = (i >= 0 ? text.slice(0, i) : text).trim().replace(/[,:]$/, "");
    const detail = (i >= 0 ? text.slice(i + 1) : "").trim();
    return { label: label.charAt(0).toUpperCase() + label.slice(1), detail, points };
  });
}

export function JobSheet({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: (job: Job) => void }) {
  const [job, setJob] = useState<Job | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setJob(null);
    if (id) api.job(id).then(setJob).catch((e: Error) => toast({ title: "Could not open the note", description: e.message, tone: "danger" }));
  }, [id]);

  const changeStatus = async (status: Status) => {
    if (!job) return;
    setBusy(true);
    try {
      const updated = await api.setStatus(job.id, status);
      setJob(updated); onChanged(updated);
      toast({ title: `${job.company}: ${status}`, description: "Written to the note's frontmatter and status log.", tone: "success" });
    } catch (e) { toast({ title: "Status not saved", description: (e as Error).message, tone: "danger" }); }
    setBusy(false);
  };
  const saveNote = async () => {
    if (!job || !note.trim()) return;
    setBusy(true);
    try { const updated = await api.addNote(job.id, note); setJob(updated); setNote(""); toast({ title: "Note added", tone: "success" }); }
    catch (e) { toast({ title: "Note not saved", description: (e as Error).message, tone: "danger" }); }
    setBusy(false);
  };
  const [ctx, setCtx] = useState<{ ceiling: number; bar: number | null; boards: { name: string; tier: string; status: string }[] } | null>(null);
  useEffect(() => {
    Promise.all([api.summary(), api.companies()]).then(([s, c]) => setCtx({ ceiling: s.ceiling, bar: s.minScore, boards: c.map((x) => ({ name: x.name, tier: x.tier, status: x.status })) })).catch(() => {});
  }, []);
  const reasons = useMemo(() => (job ? parseReasons(job.sections.why) : []), [job]);
  const fit = job && ctx?.ceiling ? Math.max(0, Math.min(100, Math.round((job.score / ctx.ceiling) * 100))) : null;
  const board = job && ctx ? ctx.boards.find((b) => b.name.toLowerCase() === job.company.toLowerCase()) : null;
  const excerpt = job ? job.sections.description.replace(/^>.*$/m, "").replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().slice(0, 320) : "";
  const pass = async (reason: PassReason) => {
    if (!job) return;
    setBusy(true);
    try { const updated = await api.setStatus(job.id, "passed", reason); setJob(updated); onChanged(updated); toast({ title: `${job.company}: passed`, description: reason, tone: "neutral" }); }
    catch (e) { toast({ title: "Not saved", description: (e as Error).message, tone: "danger" }); }
    setBusy(false);
  };

  return (
    <Sheet open={id !== null} onOpenChange={(open) => !open && onClose()} side="right" size="lg">
      <Sheet.Content>
        {!job ? (
          <div className="detail"><Skeleton lines={6} /></div>
        ) : (
          <div className="detail">
            <div className="sheet-head">
              <div className="sheet-head__main">
                <p className="sheet-head__meta">{job.company} · {job.location || "location n/a"} · {job.source} · found {daysAgo(job.found) || job.found}</p>
                <Sheet.Title>{job.title}</Sheet.Title>
                <div className="chips">
                  <Badge tone={job.payBand === "floor" ? "primary" : "neutral"} variant="soft" size="sm"><span className="num">{job.salaryMax ? shortPay(job.salary) : "pay not stated"}</span></Badge>
                  {job.salaryMax > 0 && <Badge tone="neutral" variant="outline" size="sm">{BAND_LABEL[job.payBand].toLowerCase()}</Badge>}
                  <Badge tone={job.remote ? "success" : "neutral"} variant={job.remote ? "soft" : "outline"} size="sm">{job.remote ? "remote" : "on-site"}</Badge>
                  <Badge tone={STATUS_TONE[job.status]} size="sm">{job.status}</Badge>
                </div>
              </div>
              <div className="sheet-head__side">
                <div className="pager__buttons">
                  {job.status === "new" && <Button tone="primary" size="sm" disabled={busy} onClick={() => changeStatus("reviewing")}>Shortlist</Button>}
                  {(job.status === "new" || job.status === "reviewing") && (
                    <Menu>
                      <Menu.Trigger asChild>
                        <Button variant="soft" size="sm" disabled={busy} trailingIcon={<Icon.ChevronDown />}>Pass</Button>
                      </Menu.Trigger>
                      <Menu.Content align="end">
                        {PASS_REASONS.map((reason) => (
                          <Menu.Item key={reason} onSelect={() => pass(reason)}>{reason}</Menu.Item>
                        ))}
                      </Menu.Content>
                    </Menu>
                  )}
                  <Select size="sm" label="Status" value={job.status} onValueChange={(v) => changeStatus(v as Status)} disabled={busy}>
                    {STATUSES.map((st) => (
                      <Select.Item key={st} value={st}>{st}</Select.Item>
                    ))}
                  </Select>
                </div>
                <div className="sheet-head__links">
                  <Button asChild variant="link" size="sm" tone="neutral">
                    <a href={job.url} target="_blank" rel="noopener noreferrer">Open posting ↗</a>
                  </Button>
                  <Button asChild variant="link" size="sm" tone="neutral">
                    <a href={job.obsidianUrl} title={job.path}>Open in Obsidian ↗</a>
                  </Button>
                  <Button variant="link" size="sm" tone="neutral" title={job.path} onClick={() => api.revealJob(job.id).catch((e: Error) => toast({ title: "Could not show the file", description: e.message, tone: "danger" }))}>
                    Show file
                  </Button>
                  <AttachPosting job={job} onAttached={(j) => { setJob(j); onChanged(j); }} />
                </div>
              </div>
            </div>
            <Tabs defaultValue="why" variant="line" size="sm">
              <Tabs.List aria-label="Job note sections">
                <Tabs.Trigger value="why">Match reasons</Tabs.Trigger>
                <Tabs.Trigger value="description">Description</Tabs.Trigger>
                <Tabs.Trigger value="application">Application packet</Tabs.Trigger>
                <Tabs.Trigger value="resume">Tailored resume</Tabs.Trigger>
                <Tabs.Trigger value="letter">Cover letter</Tabs.Trigger>
                <Tabs.Trigger value="people">People</Tabs.Trigger>
                <Tabs.Trigger value="notes">Notes</Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="why">
                <div className="split">
                  <div className="reasons">
                    <div className="reasons__head">
                      <span className="muted">
                        Scored <span className="num">{job.score}</span>{ctx?.ceiling ? <> of <span className="num">{ctx.ceiling}</span> possible</> : null} with the active criteria{ctx?.bar ? <> (bar <span className="num">{ctx.bar}</span>)</> : null}.
                      </span>
                      {fit !== null && <span className="reasons__fit num">{fit}<small> fit</small></span>}
                    </div>
                    {reasons.map((r, i) => (
                      <div key={i} className="reasons__row">
                        <div>
                          <div>{r.label}</div>
                          {r.detail && <div className="reasons__detail">{r.detail}</div>}
                        </div>
                        <span className={`num reasons__pts${r.points < 0 ? " reasons__pts--neg" : ""}`}>{r.points < 0 ? "−" : "+"}{Math.abs(r.points)}</span>
                      </div>
                    ))}
                    {reasons.length === 0 && <p className="muted">No match reasons recorded.</p>}
                    <details className="reasons__log">
                      <summary>Status log</summary>
                      <Markdown text={job.sections.log || "_Nothing yet._"} />
                    </details>
                  </div>
                  <aside className="split__aside">
                    <div>
                      <div className="microlabel">From the posting</div>
                      <p>{excerpt ? `${excerpt}${job.sections.description.length > 320 ? "…" : ""}` : "The posting had no description text. Open the posting, or attach one."}</p>
                    </div>
                    <div>
                      <div className="microlabel">Note</div>
                      <p className="num small">{job.path.split(/[\\/]/).slice(-2).join("/")}<br />status: {job.status} · found {job.found}{job.addedBy !== "scan" ? ` · added by ${job.addedBy}` : ""}</p>
                    </div>
                    <div>
                      <div className="microlabel">Board</div>
                      <p>{board ? `Tier ${board.tier} board, last fetch ${board.status || "not yet run"}.` : `${job.source}; not on the watchlist.`}</p>
                    </div>
                  </aside>
                </div>
              </Tabs.Content>
              <Tabs.Content value="description">
                <Markdown text={job.sections.description || "_The posting had no description text. Open the posting._"} />
              </Tabs.Content>
              <Tabs.Content value="application">
                <ApplicationPacket job={job} onStatus={changeStatus} busy={busy} />
              </Tabs.Content>
              <Tabs.Content value="resume">
                <TailoredResume job={job} />
              </Tabs.Content>
              <Tabs.Content value="letter">
                <CoverLetter job={job} />
              </Tabs.Content>
              <Tabs.Content value="people">
                <JobPeople job={job} />
              </Tabs.Content>
              <Tabs.Content value="notes">
                <div className="detail">
                  <Markdown text={job.sections.notes || "_No notes yet._"} />
                  <TextArea label="Add a note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Appended to the note with today's date." />
                  <div className="form__actions">
                    <Button tone="primary" size="sm" onClick={saveNote} disabled={busy || !note.trim()}>Save note</Button>
                  </div>
                </div>
              </Tabs.Content>
            </Tabs>
          </div>
        )}
      </Sheet.Content>
    </Sheet>
  );
}

/**
 * The application packet: every field, what is in it, and what is still required.
 *
 * The point of the screen is the gap between "drafted" and "sent". An agent can fill these fields and move
 * the job to `ready`; it cannot mark it applied, because nothing here can send anything and so nothing here
 * can honestly record that something was sent. That last step is a person's, and it asks first.
 */
function ApplicationPacket({ job, onStatus, busy }: { job: Job; onStatus: (s: Status) => void; busy: boolean }) {
  const [packet, setPacket] = useState<Packet | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState("");

  const load = () => api.packet(job.id).then((p) => { setPacket(p); setDraft(p.values); }).catch((e: Error) => toast({ title: "Could not read the packet", description: e.message, tone: "danger" }));
  useEffect(() => { load(); }, [job.id]);

  const save = async (field: string) => {
    if (!packet || draft[field] === packet.values[field]) return;
    setSaving(field);
    try {
      await api.saveApplication(job.id, field, draft[field] ?? "");
      await load();
      toast({ title: `${field} saved`, description: "Written into the note.", tone: "success" });
    } catch (e) {
      toast({ title: `${field} not saved`, description: (e as Error).message, tone: "danger" });
    } finally { setSaving(""); }
  };

  if (!packet) return <div className="detail"><Skeleton lines={6} /></div>;

  return (
    <div className="detail">
      <div className="packet__state">
        <Badge tone={packet.ready ? "success" : "neutral"} variant={packet.ready ? "soft" : "outline"}>
          {packet.filled} of {packet.total} filled
        </Badge>
        {packet.ready ? (
          <p className="muted">Every required field has something in it. Read it before you send it — this says the boxes are full, not that the application is good.</p>
        ) : (
          <p className="muted">Still required: {packet.missing.join(", ")}.</p>
        )}
      </div>

      {packet.ready && job.status !== "applied" && (
        <div className="form__actions form__actions--start">
          {job.status !== "ready" && <Button size="sm" tone="primary" variant="soft" disabled={busy} onClick={() => onStatus("ready")}>Mark ready for approval</Button>}
          <Button size="sm" tone="primary" disabled={busy} onClick={() => { if (window.confirm(`Only mark this applied if you have actually sent it to ${job.company}. Nothing here can send an application.`)) onStatus("applied"); }}>
            I have applied
          </Button>
        </div>
      )}

      {packet.fields.map(({ field, hint, required }) => (
        <div key={field} className="packet__field">
          <TextArea
            label={required ? `${field} *` : field}
            description={hint}
            rows={field === "Tailored summary" || field === "Tailored bullets" || field === "Cover letter" || field === "Outreach message" || field === "Questions" || field === "Risks" ? 3 : 1}
            value={draft[field] ?? ""}
            onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
            onBlur={() => save(field)}
            placeholder={required ? "Required before this is ready." : ""}
          />
          {saving === field && <span className="muted">Saving…</span>}
        </div>
      ))}

      <p className="muted">
        Fields are written into the note's Application section as you leave each one. An agent fills the same
        fields through the TekJobs MCP server — see Agent access.
      </p>
    </div>
  );
}
