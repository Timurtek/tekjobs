import { Badge, Button, Card, CodeBlock, Icon, Loader, Select, Skeleton, Table, toast } from "@/components/ui";
import { useEffect, useState } from "react";
import { api, type CriteriaPreset, type RunDay, type ScanState } from "../api";

const ACTIVE = "__active__";

export function Runs() {
  const [days, setDays] = useState<RunDay[] | null>(null);
  const [scan, setScan] = useState<ScanState | null>(null);
  const [presets, setPresets] = useState<CriteriaPreset[]>([]);
  const [criteria, setCriteria] = useState(ACTIVE);

  const loadRuns = () => api.runs().then(setDays).catch(() => setDays([]));
  useEffect(() => { loadRuns(); api.scan().then(setScan).catch(() => {}); api.criteriaPresets().then(setPresets).catch(() => setPresets([])); }, []);
  useEffect(() => {
    if (!scan?.running) return;
    const t = setInterval(() => api.scan().then((s) => { setScan(s); if (!s.running) loadRuns(); }).catch(() => {}), 2000);
    return () => clearInterval(t);
  }, [scan?.running]);

  const start = async (dry: boolean) => {
    const preset = criteria === ACTIVE ? undefined : criteria;
    try { setScan(await api.startScan(dry, preset)); toast({ title: dry ? "Dry run started" : "Scan started", description: `Every board, scored with ${preset ? `the "${preset}" preset` : "the active criteria"}.`, tone: "success" }); }
    catch (e) { toast({ title: "Could not start", description: (e as Error).message, tone: "danger" }); }
  };

  return (
    <>
      <div className="page__head">
        <div>
          <p>Each scan fetches every board, scores, and writes new matches to the vault. The daily task runs at 07:30 with the active criteria; here you can run one now, with the active set or a preset from the Criteria page.</p>
        </div>
        <div className="pager__buttons">
          <Select size="sm" label="Score with" value={criteria} onValueChange={setCriteria} disabled={!!scan?.running}>
            <Select.Item value={ACTIVE}>Active criteria</Select.Item>
            {presets.map((p) => (
              <Select.Item key={p.name} value={p.name}>{p.name}</Select.Item>
            ))}
          </Select>
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
                <h2>{scan.running ? "Running" : `Finished with exit code ${scan.exitCode ?? "?"}`}</h2>
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
              {days.flatMap((d) => d.runs.map((r, i) => (
                <Table.Row key={`${d.date}-${i}`}>
                  <Table.Cell>{r.when}</Table.Cell>
                  <Table.Cell>
                    <Badge tone={r.boardsOk === r.boardsTotal ? "success" : "warning"} size="sm">{r.boardsOk}/{r.boardsTotal}</Badge>
                    {r.failed && <span className="muted"> {r.failed}</span>}
                  </Table.Cell>
                  <Table.Cell><span className="muted">{r.criteria || "—"}</span></Table.Cell>
                  <Table.Cell align="end" numeric>{r.scanned.toLocaleString()}</Table.Cell>
                  <Table.Cell align="end" numeric>{r.matched}</Table.Cell>
                  <Table.Cell align="end" numeric>{r.newMatches}</Table.Cell>
                  <Table.Cell align="end" numeric>{r.closed}</Table.Cell>
                  <Table.Cell align="end" numeric>{r.seconds}</Table.Cell>
                </Table.Row>
              )))}
              {days.length === 0 && (
                <Table.Row><Table.Cell colSpan={8}><span className="muted">No scans logged yet.</span></Table.Cell></Table.Row>
              )}
            </Table.Body>
          </Table>
        )}
      </Card>
    </>
  );
}
