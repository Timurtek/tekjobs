import { Badge, BarChart, Button, Card, LineChart, Skeleton, Table } from "@/components/ui";
import { useEffect, useState } from "react";
import { api, money, type Outcomes, type RunEntry, type Summary } from "../api";
import { StatCard } from "../components/StatCard";
import type { Page } from "../components/Shell";

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);

export function Overview({ onNavigate }: { onNavigate: (page: Page, q?: string) => void }) {
  const [s, setS] = useState<Summary | null>(null);
  const [o, setO] = useState<Outcomes | null>(null);
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api.summary().then(setS).catch((e: Error) => setError(e.message));
    api.outcomes().then(setO).catch(() => {});
    api.runs().then((days) => setRuns(days.flatMap((d) => d.runs.map((r) => ({ ...r, date: d.date }))).sort((a, b) => a.when.localeCompare(b.when)))).catch(() => {});
  }, []);

  if (error) return <Card padding="md"><p className="muted">The server is not answering: {error}. Start it with <code>npm run server</code>.</p></Card>;
  if (!s) return <Skeleton variant="rect" height="12rem" />;

  const bands = ["floor", "stretch", "below", "unknown"] as const;
  const statuses = ["new", "reviewing", "applying", "applied", "interviewing", "offer", "rejected", "passed"] as const;
  const trend = runs.slice(-12);

  return (
    <>
      <div className="page__head">
        <div>
          <p>
            {s.open} open remote matches across {s.companies} boards. Floor {s.floor ? money(s.floor) : "unset"}, stretch {s.stretch ? money(s.stretch) : "unset"}, score bar {s.minScore ?? "unset"}.
          </p>
        </div>
        <Button variant="soft" size="sm" onClick={() => onNavigate("runs")}>
          Run a scan
        </Button>
      </div>

      {o && (
        <div className="stats z-stagger">
          <StatCard label="Applied" value={String(o.funnel.applied)} hint={`${o.funnel.shortlisted} shortlisted, ${o.funnel.reviewed} reviewed`} tone="primary" onClick={() => onNavigate("pipeline")} />
          <StatCard label="Response rate" value={pct(o.responseRate)} hint={o.funnel.applied ? `${o.responded} of ${o.funnel.applied} answered (interview or no)` : "nothing applied to yet"} tone={o.responseRate && o.responseRate > 0 ? "success" : "neutral"} />
          <StatCard label="Waiting 14 days or more" value={String(o.waiting.buckets["14"] ?? 0)} hint={`${o.waiting.buckets["7"] ?? 0} past 7 days, ${o.waiting.buckets["21"] ?? 0} past 21`} tone={(o.waiting.buckets["21"] ?? 0) > 0 ? "warning" : "neutral"} />
          <StatCard label="Discovery to application" value={o.medianDaysToApply === null ? "—" : `${o.medianDaysToApply}d`} hint="median, found to applied" />
        </div>
      )}

      {o && o.funnel.applied > 0 && (
        <div className="charts">
          <Card padding="md">
            <div className="panel">
              <div className="panel__head">
                <div>
                  <h2>Funnel</h2>
                  <p>How far the jobs found have gone. Each step counts everything that reached it, whatever happened after.</p>
                </div>
              </div>
              <BarChart series={[{ name: "Jobs", values: [o.funnel.reviewed, o.funnel.shortlisted, o.funnel.applied, o.funnel.interviewing, o.funnel.offer] }]} labels={["Reviewed", "Shortlisted", "Applied", "Interviewing", "Offer"]} height={200} aria-label="Application funnel" />
              <p className="muted">{o.funnel.found} found in all; {o.passed} passed on, {o.rejected} rejected.</p>
            </div>
          </Card>
          <Card padding="none">
            <div className="panel" style={{ padding: "var(--spacing-4) var(--spacing-4) 0" }}>
              <div className="panel__head">
                <div>
                  <h2>Waiting for an answer</h2>
                  <p>Applied, nothing back yet, oldest first. The date is the packet's Applied on, or the day the status changed. A follow-up belongs in the packet.</p>
                </div>
              </div>
            </div>
            <Table aria-label="Applications waiting for a response" density="md">
              <Table.Head>
                <Table.Row>
                  <Table.HeadCell>Company</Table.HeadCell>
                  <Table.HeadCell>Role</Table.HeadCell>
                  <Table.HeadCell>Applied</Table.HeadCell>
                  <Table.HeadCell align="end" numeric>Days</Table.HeadCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {o.waiting.oldest.map((w) => (
                  <Table.Row key={w.id} interactive onClick={() => onNavigate("jobs", w.company)}>
                    <Table.Cell>{w.company}</Table.Cell>
                    <Table.Cell><span className="clamp">{w.title}</span></Table.Cell>
                    <Table.Cell><span className="muted">{w.appliedOn}</span></Table.Cell>
                    <Table.Cell align="end" numeric><Badge size="sm" tone={w.days >= 21 ? "warning" : "neutral"}>{w.days}</Badge></Table.Cell>
                  </Table.Row>
                ))}
                {o.waiting.oldest.length === 0 && (
                  <Table.Row><Table.Cell colSpan={4}><span className="muted">Nothing is waiting.</span></Table.Cell></Table.Row>
                )}
              </Table.Body>
            </Table>
          </Card>
        </div>
      )}

      {o && o.bySource.length > 0 && (
        <Card padding="md">
          <div className="panel">
            <div className="panel__head">
              <div>
                <h2>Where the applications came from</h2>
                <p>Applied and answered, by the board that surfaced the job.</p>
              </div>
            </div>
            <div className="chips">
              {o.bySource.map((b) => (
                <Badge key={b.source} size="sm" tone={b.responded ? "success" : "neutral"} variant="soft">{b.source}: {b.applied} applied{b.responded ? `, ${b.responded} answered` : ""}</Badge>
              ))}
            </div>
          </div>
        </Card>
      )}

      <div className="stats z-stagger">
        <StatCard label="Open matches" value={String(s.open)} hint={`${s.byStatus.new ?? 0} unreviewed`} onClick={() => onNavigate("jobs")} />
        <StatCard label="Design-engineer roles at the floor" value={String(s.designEng.floor)} hint={`of ${s.designEng.total} with the title`} tone="success" onClick={() => onNavigate("jobs")} />
        <StatCard label="Pay under the floor, above the stretch line" value={String(s.byBand.stretch ?? 0)} hint={`${s.designEng.stretch} design-engineer`} tone="warning" />
        <StatCard label="Active applications" value={String(s.active)} hint={s.active ? "in flight" : "none yet"} tone={s.active ? "primary" : "neutral"} onClick={() => onNavigate("pipeline")} />
      </div>

      <div className="charts">
        <Card padding="md">
          <div className="panel">
            <div className="panel__head">
              <div>
                <h2>New matches per scan</h2>
                <p>What each run added, most recent on the right.</p>
              </div>
              {s.lastRun && (
                <Badge tone={s.lastRun.boardsOk === s.lastRun.boardsTotal ? "success" : "warning"} size="sm">
                  {s.lastRun.boardsOk}/{s.lastRun.boardsTotal} boards
                </Badge>
              )}
            </div>
            {trend.length > 1 ? (
              <LineChart series={[{ name: "New matches", values: trend.map((r) => r.newMatches) }]} labels={trend.map((r) => r.when.slice(5, 16))} area height={220} aria-label="New matches per scan" />
            ) : (
              <p className="muted">One scan so far. The trend appears after the second.</p>
            )}
          </div>
        </Card>
        <Card padding="md">
          <div className="panel">
            <div className="panel__head">
              <div>
                <h2>Stated pay against the floor</h2>
                <p>Open matches by band.</p>
              </div>
            </div>
            <BarChart series={[{ name: "Matches", values: bands.map((b) => s.byBand[b] ?? 0) }]} labels={["Floor", "Stretch", "Below", "Not stated"]} height={220} aria-label="Matches by pay band" />
          </div>
        </Card>
      </div>

      <div className="charts">
        <Card padding="md">
          <div className="panel">
            <div className="panel__head">
              <div>
                <h2>Pipeline</h2>
                <p>Every open note by status. Change a status in Jobs or Pipeline; the note is the record.</p>
              </div>
            </div>
            <BarChart series={[{ name: "Jobs", values: statuses.map((st) => s.byStatus[st] ?? 0) }]} labels={[...statuses]} height={200} aria-label="Jobs by status" />
          </div>
        </Card>
        <Card padding="md">
          <div className="panel">
            <div className="panel__head">
              <div>
                <h2>Last scan</h2>
                <p>{s.lastRun ? `${s.lastRun.when}` : "No scan recorded yet."}</p>
              </div>
            </div>
            {s.lastRun && (
              <dl className="detail__grid">
                <div><dt>Postings scanned</dt><dd>{s.lastRun.scanned.toLocaleString()}</dd></div>
                <div><dt>Above the bar</dt><dd>{s.lastRun.matched}</dd></div>
                <div><dt>New notes</dt><dd>{s.lastRun.newMatches}</dd></div>
                <div><dt>Closed listings</dt><dd>{s.lastRun.closed}</dd></div>
                <div><dt>Duration</dt><dd>{s.lastRun.seconds}s</dd></div>
                <div><dt>Failed boards</dt><dd>{s.lastRun.failed ? s.lastRun.failed : "none"}</dd></div>
              </dl>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
