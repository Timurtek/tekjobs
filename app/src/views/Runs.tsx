import { Badge, Button, Card, CodeBlock, Icon, Loader, Select, Skeleton, Table, Tooltip, toast } from "@/components/ui";
import { useEffect, useState } from "react";
import { api, type CriteriaPreset, type RunDay, type RunEntry, type RunOutcome, type ScanState } from "../api";

const ACTIVE = "__active__";

/** One word per run, and the tone it shows in. */
const OUTCOME: Record<RunOutcome, { label: string; tone: "success" | "warning" | "danger" }> = {
  success: { label: "Success", tone: "success" },
  partial: { label: "Partial", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
};
const kindOf = (r: Pick<RunEntry, "dry" | "via">) => (r.dry ? "dry run" : r.via === "schedule" ? "scheduled" : r.via === "mcp" ? "agent" : r.via === "cli" ? "manual, CLI" : r.via === "app" ? "manual" : "");
/** "2026-09-23 07:30 UTC" as the browser's own clock, for the tooltip. */
const local = (when: string) => { const m = when.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) UTC$/); if (!m) return ""; const d = new Date(`${m[1]}T${m[2]}:00Z`); return Number.isNaN(d.getTime()) ? "" : `${d.toLocaleString()} local`; };

/** What the live scan's output says it did, once it has finished; the same words the history uses. */
function liveOutcome(scan: ScanState): RunOutcome | null {
  if (scan.running || scan.exitCode === null) return null;
  if (scan.exitCode !== 0) return "failed";
  const line = scan.output.find((l) => /Boards: \d+\/\d+/.test(l)) || "";
  const m = line.match(/Boards: (\d+)\/(\d+)/);
  const feedsFailed = scan.output.some((l) => /^- .+?: failed: /.test(l) || /^\s+x /.test(l));
  if (!m) return "success";
  if (Number(m[1]) === 0 && Number(m[2]) > 0) return "failed";
  return Number(m[1]) === Number(m[2]) && !feedsFailed ? "success" : "partial";
}

export function Runs() {
  const [days, setDays] = useState<RunDay[] | null>(null);
  const [scan, setScan] = useState<ScanState | null>(null);
  const [presets, setPresets] = useState<CriteriaPreset[]>([]);
  const [criteria, setCriteria] = useState(ACTIVE);
  const [open, setOpen] = useState<string | null>(null);

  const loadRuns = () => api.runs().then(setDays).catch(() => setDays([]));
  useEffect(() => { loadRuns(); api.scan().then(setScan).catch(() => {}); api.criteriaPresets().then(setPresets).catch(() => setPresets([])); }, []);
  useEffect(() => {
    if (!scan?.running) return;
    const t = setInterval(() => api.scan().then((s) => { setScan(s); if (!s.running) loadRuns(); }).catch(() => {}), 2000);
    return () => clearInterval(t);
  }, [scan?.running]);

  const start = async (dry: boolean, retryFailed = false) => {
    const preset = criteria === ACTIVE ? undefined : criteria;
    try {
      setScan(await api.startScan(dry, preset, retryFailed));
      toast({ title: retryFailed ? "Retrying the failed boards" : dry ? "Dry run started" : "Scan started", description: retryFailed ? "Only the boards whose last attempt failed, no feeds." : `Every board, scored with ${preset ? `the "${preset}" preset` : "the active criteria"}.`, tone: "success" });
    } catch (e) { toast({ title: "Could not start", description: (e as Error).message, tone: "danger" }); }
  };

  // Days come newest first; runs inside a day are logged oldest first. Newest first throughout, so rows[0] is the last run.
  const rows = (days ?? []).flatMap((d) => d.runs.map((r, i) => ({ ...r, key: `${d.date}-${i}` })).reverse());
  const latest = rows[0];
  const latestLeftBoards = !!latest && !latest.dry && latest.boardsOk < latest.boardsTotal;
  const live = scan ? liveOutcome(scan) : null;

  return (
    <>
      <div className="page__head">
        <div>
          <p>Each scan fetches every board, scores, and writes new matches to the vault. The morning task runs it with the active criteria; here you can run one now, with the active set or a preset from the Criteria page. Times are UTC; hover one for your clock.</p>
        </div>
        <div className="pager__buttons">
          <Select size="sm" label="Score with" value={criteria} onValueChange={setCriteria} disabled={!!scan?.running}>
            <Select.Item value={ACTIVE}>Active criteria</Select.Item>
            {presets.map((p) => (
              <Select.Item key={p.name} value={p.name}>{p.name}</Select.Item>
            ))}
          </Select>
          {latestLeftBoards && (
            <Tooltip content={`${latest.boardsTotal - latest.boardsOk} board${latest.boardsTotal - latest.boardsOk === 1 ? "" : "s"} did not answer last time. Fetch only those; Sources shows each one's health.`}>
              <Button variant="soft" tone="danger" size="sm" disabled={!!scan?.running} leadingIcon={<Icon.Refresh />} onClick={() => start(false, true)}>Retry failed</Button>
            </Tooltip>
          )}
          <Button variant="soft" size="sm" disabled={!!scan?.running} onClick={() => start(true)}>Dry run</Button>
          <Button tone="primary" size="sm" disabled={!!scan?.running} leadingIcon={scan?.running ? <Loader size="sm" /> : <Icon.Refresh />} onClick={() => start(false)}>
            {scan?.running ? "Scanning" : "Scan now"}
          </Button>
        </div>
      </div>

      {scan && (scan.running || scan.output.length > 0) && (
        <Card padding="md">
          <div className="panel">
            <div className="panel__head">
              <div>
                <h2 className="runs__live">
                  {scan.running ? "Running" : live ? <><Badge tone={OUTCOME[live].tone} size="sm">{OUTCOME[live].label}</Badge> <span>{live === "failed" ? `exit code ${scan.exitCode}` : "finished"}</span></> : "Finished"}
                </h2>
                <p>{scan.startedAt ? `Started ${scan.startedAt.replace("T", " ").slice(0, 19)} UTC` : ""}{scan.criteria ? ` · preset "${scan.criteria}"` : ""}</p>
              </div>
              {scan.running && <Loader showLabel label="Fetching boards" size="sm" />}
            </div>
            <CodeBlock code={scan.output.slice(-40).join("\n") || "…"} language="text" showCopy={false} wrap />
          </div>
        </Card>
      )}

      <Card padding="none">
        {days === null ? (
          <div className="loading"><Skeleton lines={6} /></div>
        ) : (
          <Table aria-label="Scan history" density="md">
            <Table.Head>
              <Table.Row>
                <Table.HeadCell>Outcome</Table.HeadCell>
                <Table.HeadCell>When</Table.HeadCell>
                <Table.HeadCell>Boards</Table.HeadCell>
                <Table.HeadCell>Criteria</Table.HeadCell>
                <Table.HeadCell align="end" numeric>Scanned</Table.HeadCell>
                <Table.HeadCell align="end" numeric>Above bar</Table.HeadCell>
                <Table.HeadCell align="end" numeric>New</Table.HeadCell>
                <Table.HeadCell align="end" numeric>Closed</Table.HeadCell>
                <Table.HeadCell align="end" numeric>Seconds</Table.HeadCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {rows.map((r) => {
                const problems = [...(r.failed ? r.failed.split(/;\s*/).filter(Boolean).map((x) => `board: ${x}`) : []), ...(r.feedsFailed || []).map((x) => `feed: ${x}`)];
                const expandable = problems.length > 0;
                const isOpen = open === r.key;
                return [
                  <Table.Row key={r.key} interactive={expandable} onClick={expandable ? () => setOpen(isOpen ? null : r.key) : undefined} aria-expanded={expandable ? isOpen : undefined}>
                    <Table.Cell>
                      <div className="runs__outcome">
                        <Badge tone={OUTCOME[r.outcome].tone} variant={r.outcome === "success" ? "soft" : "solid"} size="sm">{OUTCOME[r.outcome].label}</Badge>
                        {kindOf(r) && <small className="muted">{kindOf(r)}</small>}
                      </div>
                    </Table.Cell>
                    <Table.Cell><span className="num" title={local(r.when)}>{r.when}</span></Table.Cell>
                    <Table.Cell>
                      <span className="num">{r.boardsOk}/{r.boardsTotal}</span>
                      {expandable && <span className="muted"> · {problems.length} problem{problems.length === 1 ? "" : "s"} {isOpen ? "▾" : "▸"}</span>}
                    </Table.Cell>
                    <Table.Cell><span className="muted">{r.criteria || "—"}</span></Table.Cell>
                    <Table.Cell align="end" numeric>{r.scanned.toLocaleString()}</Table.Cell>
                    <Table.Cell align="end" numeric>{r.matched}</Table.Cell>
                    <Table.Cell align="end" numeric>{r.dry ? <span className="muted">—</span> : r.newMatches}</Table.Cell>
                    <Table.Cell align="end" numeric>{r.dry ? <span className="muted">—</span> : r.closed}</Table.Cell>
                    <Table.Cell align="end" numeric>{r.seconds}</Table.Cell>
                  </Table.Row>,
                  expandable && isOpen ? (
                    <Table.Row key={`${r.key}-problems`}>
                      <Table.Cell colSpan={9}>
                        <ul className="runs__problems">
                          {problems.map((p) => <li key={p} className="mono">{p}</li>)}
                        </ul>
                        <p className="muted">A board that fails once is usually a hiccup; one that fails every run has moved. Sources shows each board's health and last success.</p>
                      </Table.Cell>
                    </Table.Row>
                  ) : null,
                ];
              })}
              {rows.length === 0 && (
                <Table.Row><Table.Cell colSpan={9}><span className="muted">No scans logged yet.</span></Table.Cell></Table.Row>
              )}
            </Table.Body>
          </Table>
        )}
      </Card>
    </>
  );
}
