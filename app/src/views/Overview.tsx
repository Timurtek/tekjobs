import { Badge, BarChart, Button, Card, Skeleton, Table } from "@/components/ui";
import { useEffect, useState } from "react";
import { api, money, type Outcomes, type Summary } from "../api";
import { StatCard } from "../components/StatCard";
import type { Page } from "../components/Shell";

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
const STAGE_LABEL: Record<string, string> = { found: "Found", reviewed: "Reviewed", shortlisted: "Shortlisted", applied: "Applied", interviewing: "Interviewing", offer: "Offer" };
const KIND_LABEL: Record<string, string> = { "design-eng": "Design engineering", adjacent: "Adjacent titles" };

/**
 * Whether the search is working: the funnel with its stage-to-stage rates, the response rate, how long things
 * wait, what needs a hand this week, and which role families and boards actually turn into answers. The
 * inventory (open matches by band and status) follows; the scan's own diagnostics live on Runs.
 */
export function Overview({ onNavigate }: { onNavigate: (page: Page, q?: string) => void }) {
  const [s, setS] = useState<Summary | null>(null);
  const [o, setO] = useState<Outcomes | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api.summary().then(setS).catch((e: Error) => setError(e.message));
    api.outcomes().then(setO).catch(() => {});
  }, []);

  if (error) return <Card padding="md"><p className="muted">The server is not answering: {error}. Start it with <code>npm run server</code>.</p></Card>;
  if (!s || !o) return <Skeleton variant="rect" height="12rem" />;

  const bands = ["floor", "stretch", "below", "unknown"] as const;
  const statuses = ["new", "reviewing", "applying", "applied", "interviewing", "offer", "rejected", "passed"] as const;
  const waiting14 = o.waiting.buckets["14"] ?? 0;
  const dueNow = o.thisWeek.followUps.filter((f) => f.inDays <= 0).length;
  const weeks = o.appliedPerWeek;

  return (
    <>
      <div className="page__head">
        <div>
          <p>
            <b>{o.funnel.applied}</b> applied, <b>{pct(o.responseRate)}</b> answered, <b>{o.funnel.interviewing}</b> interviewing{waiting14 ? <>, <b>{waiting14}</b> waiting two weeks or more</> : null}.
            {" "}The inventory: {s.open} open matches across {s.companies} boards, floor {s.floor ? money(s.floor) : "unset"}, bar {s.minScore ?? "unset"}.
          </p>
        </div>
        <Button variant="soft" size="sm" onClick={() => onNavigate("runs")}>Runs</Button>
      </div>

      <div className="stats z-stagger">
        <StatCard label="Applied" value={String(o.funnel.applied)} hint={`${o.funnel.shortlisted} shortlisted, ${o.funnel.reviewed} reviewed`} tone="primary" onClick={() => onNavigate("pipeline")} />
        <StatCard label="Response rate" value={pct(o.responseRate)} hint={o.funnel.applied ? `${o.responded} of ${o.funnel.applied} answered, interview or no` : "nothing applied to yet"} tone={o.responseRate && o.responseRate > 0 ? "success" : "neutral"} />
        <StatCard label="Waiting 14 days or more" value={String(waiting14)} hint={`${o.waiting.buckets["7"] ?? 0} past 7 days, ${o.waiting.buckets["21"] ?? 0} past 21`} tone={(o.waiting.buckets["21"] ?? 0) > 0 ? "warning" : "neutral"} />
        <StatCard label="Discovery to application" value={o.medianDaysToApply === null ? "—" : `${o.medianDaysToApply}d`} hint="median, found to applied" />
      </div>

      <div className="charts">
        <Card padding="none">
          <div className="panel panel--pad">
            <div className="panel__head">
              <div>
                <h2>Funnel</h2>
                <p>Each stage counts everything that reached it, whatever happened after. The rate is the share of the stage before.</p>
              </div>
            </div>
          </div>
          <Table aria-label="Application funnel" density="md">
            <Table.Head>
              <Table.Row>
                <Table.HeadCell>Stage</Table.HeadCell>
                <Table.HeadCell align="end" numeric>Jobs</Table.HeadCell>
                <Table.HeadCell align="end" numeric>Of the stage before</Table.HeadCell>
                <Table.HeadCell>Share</Table.HeadCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {o.stages.map((st, i) => {
                const max = o.stages[0]?.count || 1;
                return (
                  <Table.Row key={st.stage}>
                    <Table.Cell>{STAGE_LABEL[st.stage] ?? st.stage}</Table.Cell>
                    <Table.Cell align="end" numeric>{st.count}</Table.Cell>
                    <Table.Cell align="end" numeric><span className={st.rate === null ? "muted" : ""}>{i === 0 ? "—" : pct(st.rate)}</span></Table.Cell>
                    <Table.Cell><div className="funnel__bar" role="presentation"><span style={{ width: `${Math.max(st.count ? 2 : 0, Math.round((st.count / max) * 100))}%` }} /></div></Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
          <p className="muted panel--pad">{o.passed} passed on, {o.rejected} rejected.</p>
        </Card>

        <Card padding="none">
          <div className="panel panel--pad">
            <div className="panel__head">
              <div>
                <h2>This week</h2>
                <p>Follow-ups due in the next seven days{dueNow ? `, ${dueNow} already past` : ""}, and the interviews in progress. Dates come from each note's packet.</p>
              </div>
            </div>
          </div>
          <Table aria-label="This week" density="md">
            <Table.Head>
              <Table.Row>
                <Table.HeadCell>Company</Table.HeadCell>
                <Table.HeadCell>Role</Table.HeadCell>
                <Table.HeadCell align="end">When</Table.HeadCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {o.thisWeek.followUps.map((f) => (
                <Table.Row key={f.id} interactive onClick={() => onNavigate("jobs", f.company)}>
                  <Table.Cell>{f.company}</Table.Cell>
                  <Table.Cell><span className="clamp">{f.title}</span></Table.Cell>
                  <Table.Cell align="end"><Badge size="sm" tone={f.inDays < 0 ? "danger" : f.inDays === 0 ? "warning" : "neutral"}>{f.inDays < 0 ? `follow up, ${-f.inDays}d late` : f.inDays === 0 ? "follow up today" : `follow up in ${f.inDays}d`}</Badge></Table.Cell>
                </Table.Row>
              ))}
              {o.thisWeek.interviewing.map((j) => (
                <Table.Row key={j.id} interactive onClick={() => onNavigate("jobs", j.company)}>
                  <Table.Cell>{j.company}</Table.Cell>
                  <Table.Cell><span className="clamp">{j.title}</span></Table.Cell>
                  <Table.Cell align="end"><Badge size="sm" tone="primary">interviewing</Badge></Table.Cell>
                </Table.Row>
              ))}
              {o.thisWeek.followUps.length === 0 && o.thisWeek.interviewing.length === 0 && (
                <Table.Row><Table.Cell colSpan={3}><span className="muted">Nothing due this week. Applied roles get a follow-up date in their packet when you mark them applied.</span></Table.Cell></Table.Row>
              )}
            </Table.Body>
          </Table>
        </Card>
      </div>

      <div className="charts">
        <Card padding="md">
          <div className="panel">
            <div className="panel__head">
              <div>
                <h2>Applications per week</h2>
                <p>Sent, by the week of the packet's Applied on date.</p>
              </div>
            </div>
            {weeks.length > 0 ? (
              <BarChart series={[{ name: "Applied", values: weeks.map((w) => w.n) }]} labels={weeks.map((w) => w.week.slice(5))} height={180} aria-label="Applications per week" />
            ) : (
              <p className="muted">Nothing applied to yet.</p>
            )}
          </div>
        </Card>
        <Card padding="none">
          <div className="panel panel--pad">
            <div className="panel__head">
              <div>
                <h2>What answers</h2>
                <p>By role family, then by the board that surfaced the job.</p>
              </div>
            </div>
          </div>
          <Table aria-label="Outcomes by role family" density="md">
            <Table.Head>
              <Table.Row>
                <Table.HeadCell>Role family</Table.HeadCell>
                <Table.HeadCell align="end" numeric>Found</Table.HeadCell>
                <Table.HeadCell align="end" numeric>Applied</Table.HeadCell>
                <Table.HeadCell align="end" numeric>Answered</Table.HeadCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {o.byKind.map((k) => (
                <Table.Row key={k.kind}>
                  <Table.Cell>{KIND_LABEL[k.kind] ?? k.kind}</Table.Cell>
                  <Table.Cell align="end" numeric>{k.found}</Table.Cell>
                  <Table.Cell align="end" numeric>{k.applied}</Table.Cell>
                  <Table.Cell align="end" numeric>{k.applied ? `${k.responded} (${pct(k.responded / k.applied)})` : "—"}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
          {o.bySource.length > 0 && (
            <div className="chips panel--pad">
              {o.bySource.map((b) => (
                <Badge key={b.source} size="sm" tone={b.responded ? "success" : "neutral"} variant="soft">{b.source}: {b.applied} applied{b.responded ? `, ${b.responded} answered` : ""}</Badge>
              ))}
            </div>
          )}
        </Card>
      </div>

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
                <h2>Stated pay against the floor</h2>
                <p>Open matches by band.</p>
              </div>
            </div>
            <BarChart series={[{ name: "Matches", values: bands.map((b) => s.byBand[b] ?? 0) }]} labels={["Floor", "Stretch", "Below", "Not stated"]} height={200} aria-label="Matches by pay band" />
          </div>
        </Card>
      </div>
    </>
  );
}
