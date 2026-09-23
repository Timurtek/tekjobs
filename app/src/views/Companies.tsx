import { Badge, Button, Card, Dialog, Icon, Select, Skeleton, Table, TextField, Tooltip, toast } from "@/components/ui";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api, daysAgo, type Company, type Feed, type HealthState } from "../api";

const ATS = ["greenhouse", "lever", "ashby", "workday", "rippling", "smartrecruiters", "workable", "bamboohr", "breezy", "personio", "teamtailor", "eightfold"];

/** The states in the order they deserve attention, with the word and tone each one shows as. */
const STATES: { key: HealthState; label: string; tone: "danger" | "warning" | "neutral" | "success" }[] = [
  { key: "failed", label: "Failed", tone: "danger" },
  { key: "zero", label: "Zero jobs", tone: "warning" },
  { key: "stale", label: "Stale", tone: "warning" },
  { key: "never", label: "Never fetched", tone: "neutral" },
  { key: "ok", label: "Healthy", tone: "success" },
];
const TONE = Object.fromEntries(STATES.map((s) => [s.key, s.tone])) as Record<HealthState, "danger" | "warning" | "neutral" | "success">;
const LABEL = Object.fromEntries(STATES.map((s) => [s.key, s.label])) as Record<HealthState, string>;

/**
 * Sources: the company boards the scan reads, each with where it stands (failed, zero, stale, never, healthy),
 * and the aggregator feeds under them. A flat list of hundreds of boards is not operable; the state filters and
 * "Retry failed" are what make it one. Last success and last attempt are shown apart, because a board that
 * answered with nothing today and 40 jobs last week is a moved slug, not a quiet company.
 */
export function Companies() {
  const [rows, setRows] = useState<Company[] | null>(null);
  const [feeds, setFeeds] = useState<Feed[] | null>(null);
  const [q, setQ] = useState("");
  const [tier, setTier] = useState("all");
  const [state, setState] = useState<HealthState | "all">("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", ats: "greenhouse", slug: "", tier: "B", notes: "" });
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    api.companies().then(setRows).catch((e: Error) => toast({ title: "Could not load the watchlist", description: e.message, tone: "danger" }));
    api.feeds().then(setFeeds).catch(() => setFeeds([]));
  }, []);
  const counts = useMemo(() => { const c: Record<string, number> = {}; for (const r of rows ?? []) c[r.health.state] = (c[r.health.state] || 0) + 1; return c; }, [rows]);
  const visible = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const order = (s: HealthState) => STATES.findIndex((x) => x.key === s);
    return (rows ?? [])
      .filter((c) => (tier === "all" || c.tier === tier) && (state === "all" || c.health.state === state) && (!ql || `${c.name} ${c.ats} ${c.slug}`.toLowerCase().includes(ql)))
      .sort((a, b) => order(a.health.state) - order(b.health.state) || a.name.localeCompare(b.name));
  }, [rows, q, tier, state]);
  const failed = counts.failed || 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const updated = await api.addCompany(form);
      setRows(updated); setOpen(false); setForm({ name: "", ats: "greenhouse", slug: "", tier: "B", notes: "" });
      toast({ title: `${form.name} added`, description: "It is fetched on the next scan.", tone: "success" });
    } catch (err) { toast({ title: "Not added", description: (err as Error).message, tone: "danger" }); }
    setBusy(false);
  };
  const retry = async () => {
    setRetrying(true);
    try {
      const s = await api.startScan(false, undefined, true);
      toast({ title: s.running ? `Retrying ${failed} failed board${failed === 1 ? "" : "s"}` : "A scan is already running", description: s.running ? "Only the boards that failed last time, no feeds. Progress is on Runs; this page updates when it finishes." : "Wait for it to finish, then retry.", tone: s.running ? "success" : "neutral" });
    } catch (e) { toast({ title: "Could not start the retry", description: (e as Error).message, tone: "danger" }); }
    setRetrying(false);
  };

  return (
    <>
      <div className="toolbar">
        <TextField className="toolbar__search" size="sm" label="Search" placeholder="Company, platform or slug" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select className="toolbar__filter" size="sm" label="Tier" value={tier} onValueChange={setTier}>
          <Select.Item value="all">All tiers</Select.Item>
          <Select.Item value="A">A, dream</Select.Item>
          <Select.Item value="B">B, strong</Select.Item>
          <Select.Item value="C">C, fine</Select.Item>
        </Select>
        <span className="toolbar__spacer" />
        {failed > 0 && <Button size="sm" variant="soft" tone="danger" leadingIcon={<Icon.Refresh />} loading={retrying} onClick={retry}>Retry {failed} failed</Button>}
        <Dialog open={open} onOpenChange={setOpen} size="sm">
          <Dialog.Trigger asChild>
            <Button tone="primary" size="sm" leadingIcon={<Icon.Plus />}>Add a board</Button>
          </Dialog.Trigger>
          <Dialog.Content>
            <form className="form" onSubmit={submit}>
              <Dialog.Title>Watch a company board</Dialog.Title>
              <Dialog.Description>The slug is the board token in the careers URL. Rows are appended to Targets/Companies.md.</Dialog.Description>
              <TextField label="Company" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <div className="form__row">
                <Select label="Platform" value={form.ats} onValueChange={(v) => setForm({ ...form, ats: v })}>
                  {ATS.map((a) => (
                    <Select.Item key={a} value={a}>{a}</Select.Item>
                  ))}
                </Select>
                <Select label="Tier" value={form.tier} onValueChange={(v) => setForm({ ...form, tier: v })}>
                  <Select.Item value="A">A</Select.Item>
                  <Select.Item value="B">B</Select.Item>
                  <Select.Item value="C">C</Select.Item>
                </Select>
              </div>
              <TextField label="Slug" required description={form.ats === "workday" ? "host/tenant/site" : form.ats === "eightfold" ? "host/domain" : "as it appears in the board URL"} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
              <TextField label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <Dialog.Footer>
                <Dialog.Close asChild><Button variant="ghost">Cancel</Button></Dialog.Close>
                <Button type="submit" tone="primary" loading={busy}>Add</Button>
              </Dialog.Footer>
            </form>
          </Dialog.Content>
        </Dialog>
      </div>

      <div className="health" role="group" aria-label="Filter boards by health">
        <Button size="sm" variant={state === "all" ? "soft" : "ghost"} tone="neutral" onClick={() => setState("all")}>All <span className="num">{rows?.length ?? 0}</span></Button>
        {STATES.map((s) => (
          <Button key={s.key} size="sm" variant={state === s.key ? "soft" : "ghost"} tone={s.tone === "danger" ? "danger" : "neutral"} onClick={() => setState(state === s.key ? "all" : s.key)}>
            {s.label} <span className="num">{counts[s.key] || 0}</span>
          </Button>
        ))}
      </div>

      <Card padding="none">
        {rows === null ? (
          <div className="loading"><Skeleton lines={8} /></div>
        ) : (
          <Table aria-label="Company boards" density="md" stickyHeader>
            <Table.Head>
              <Table.Row>
                <Table.HeadCell>Company</Table.HeadCell>
                <Table.HeadCell>Platform</Table.HeadCell>
                <Table.HeadCell>Slug</Table.HeadCell>
                <Table.HeadCell>Tier</Table.HeadCell>
                <Table.HeadCell>Health</Table.HeadCell>
                <Table.HeadCell>Last success</Table.HeadCell>
                <Table.HeadCell>Last attempt</Table.HeadCell>
                <Table.HeadCell>Notes</Table.HeadCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {visible.map((c) => (
                <Table.Row key={`${c.ats}:${c.slug}`}>
                  <Table.Cell>{c.name}</Table.Cell>
                  <Table.Cell><span className="muted">{c.ats}</span></Table.Cell>
                  <Table.Cell><code className="mono">{c.slug}</code></Table.Cell>
                  <Table.Cell><Badge tone={c.tier === "A" ? "primary" : "neutral"} size="sm">{c.tier || "—"}</Badge></Table.Cell>
                  <Table.Cell>
                    <Tooltip content={c.health.lastError || c.status || "No fetch on record yet."}>
                      <Badge tone={TONE[c.health.state]} variant={c.health.state === "ok" ? "soft" : "solid"} size="sm">{LABEL[c.health.state]}{c.health.failStreak > 1 ? ` ×${c.health.failStreak}` : ""}</Badge>
                    </Tooltip>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="muted num">{c.health.lastOk ? `${daysAgo(c.health.lastOk)} · ${c.health.lastOkJobs} job${c.health.lastOkJobs === 1 ? "" : "s"}` : c.status && !c.status.startsWith("bad-slug") ? c.status : "—"}</span>
                  </Table.Cell>
                  <Table.Cell><span className="muted num">{c.health.lastAttempt ? daysAgo(c.health.lastAttempt) : "—"}</span></Table.Cell>
                  <Table.Cell><span className="muted">{c.notes}</span></Table.Cell>
                </Table.Row>
              ))}
              {visible.length === 0 && (
                <Table.Row>
                  <Table.Cell colSpan={8}><span className="muted">{rows.length === 0 ? "No boards on the watchlist yet. Add one, or run the onboarding to start from the registry." : "No boards match. Loosen a filter."}</span></Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        )}
      </Card>
      <p className="muted">{visible.length} of {rows?.length ?? 0} boards. Failed means the latest attempt failed; zero means it answered with nothing, which for a board that once had jobs usually means the slug moved; stale means no success in three days. The Retry button fetches only the failed boards and writes matches like any scan.</p>

      <h2 className="settings__h">Aggregator feeds</h2>
      <Card padding="none">
        {feeds === null ? (
          <div className="loading"><Skeleton lines={4} /></div>
        ) : (
          <Table aria-label="Aggregator feeds" density="md">
            <Table.Head>
              <Table.Row>
                <Table.HeadCell>Feed</Table.HeadCell>
                <Table.HeadCell>On</Table.HeadCell>
                <Table.HeadCell>Health</Table.HeadCell>
                <Table.HeadCell>Last success</Table.HeadCell>
                <Table.HeadCell>Last attempt</Table.HeadCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {feeds.map((f) => (
                <Table.Row key={f.key}>
                  <Table.Cell><div className="who__text">{f.label}<small><code className="mono">openSources.{f.key}</code>{f.needsKey ? " · needs a key" : ""}</small></div></Table.Cell>
                  <Table.Cell><Badge tone={f.enabled ? "success" : "neutral"} variant="soft" size="sm">{f.enabled ? "on" : "off"}</Badge></Table.Cell>
                  <Table.Cell>
                    {f.enabled ? (
                      <Tooltip content={f.health.lastError || "No fetch on record yet."}>
                        <Badge tone={TONE[f.health.state]} variant={f.health.state === "ok" ? "soft" : "solid"} size="sm">{LABEL[f.health.state]}</Badge>
                      </Tooltip>
                    ) : <span className="muted">—</span>}
                  </Table.Cell>
                  <Table.Cell><span className="muted num">{f.health.lastOk ? `${daysAgo(f.health.lastOk)} · ${f.health.lastOkJobs} postings` : "—"}</span></Table.Cell>
                  <Table.Cell><span className="muted num">{f.health.lastAttempt ? daysAgo(f.health.lastAttempt) : "—"}</span></Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Card>
      <p className="muted">Feeds are switched on and off in Criteria under <code className="mono">openSources</code>. TekJobs postings and RemoteOK and HN are on unless you turn them off; the rest are opt-in.</p>
    </>
  );
}
