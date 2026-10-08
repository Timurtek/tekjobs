import { Badge, Button, Card, CodeBlock, EmptyState, Skeleton, Table } from "@/components/ui";
import { useEffect, useState } from "react";
import { api, type Calendar as CalendarData, type CalendarEvent } from "../api";
import { JobSheet } from "./Jobs";

const KIND: Record<CalendarEvent["kind"], { label: string; tone: "primary" | "warning" | "danger" | "neutral" }> = {
  interview: { label: "Interview", tone: "primary" },
  "follow-up": { label: "Follow up", tone: "warning" },
  deadline: { label: "Deadline", tone: "danger" },
  applied: { label: "Applied", tone: "neutral" },
};

/** "Wednesday 14 October", from YYYY-MM-DD, in the browser's locale. */
const dayLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

/**
 * The calendar: every dated line the notes carry, read from the record. Interviews from the packet's "Interview
 * on" field (filled by hand, or by a confirmed scheduling email), follow-ups and deadlines from theirs, applied
 * dates as the trail behind. The same dates are served as an .ics feed for the calendar app on this machine.
 */
export function Calendar() {
  const [data, setData] = useState<CalendarData | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const load = () => api.calendar().then(setData).catch((e: Error) => setError(e.message));
  useEffect(() => { load(); }, []);

  if (error) return <Card padding="md"><p className="muted">The server is not answering: {error}. Start it with <code>tekjobs up</code>.</p></Card>;
  if (!data) return <Skeleton variant="rect" height="18rem" />;

  const feed = `${window.location.origin}${data.ics}`;
  const byDay = (events: CalendarEvent[]) => {
    const days = new Map<string, CalendarEvent[]>();
    for (const e of events) days.set(e.date, [...(days.get(e.date) ?? []), e]);
    return [...days.entries()];
  };
  const table = (events: CalendarEvent[], label: string) => (
    <Table aria-label={label} density="md">
      <Table.Head>
        <Table.Row>
          <Table.HeadCell>When</Table.HeadCell>
          <Table.HeadCell>What</Table.HeadCell>
          <Table.HeadCell>Company</Table.HeadCell>
          <Table.HeadCell>Role</Table.HeadCell>
          <Table.HeadCell>Status</Table.HeadCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {byDay(events).map(([date, rows]) => rows.map((e, i) => (
          <Table.Row key={`${e.id}-${e.kind}`} interactive onClick={() => setSelected(e.id)}>
            <Table.Cell>{i === 0 ? <span className="cal__day">{dayLabel(date)}</span> : null}{e.time ? <span className="num cal__time">{e.time}</span> : <span className="muted cal__time">all day</span>}</Table.Cell>
            <Table.Cell><Badge size="sm" tone={KIND[e.kind].tone} variant={e.kind === "applied" ? "outline" : "soft"}>{KIND[e.kind].label}</Badge></Table.Cell>
            <Table.Cell>{e.company}</Table.Cell>
            <Table.Cell>{e.title}</Table.Cell>
            <Table.Cell><Badge size="sm" tone="neutral">{e.status}</Badge></Table.Cell>
          </Table.Row>
        )))}
      </Table.Body>
    </Table>
  );

  return (
    <>
      <div className="page__head">
        <div>
          <p>Every dated line the notes carry: interviews from the packet's <strong>Interview on</strong> field (filled by you, or by a confirmed scheduling email), follow-ups and deadlines from theirs, and the applied dates as the trail behind. Nothing here comes from a calendar service; the record is the calendar.</p>
        </div>
        <Button asChild variant="soft" size="sm"><a href={data.ics} download="tekjobs.ics">Download .ics</a></Button>
      </div>

      <section className="today__section">
        <div className="today__section-head">
          <h2 className="today__heading">Coming up</h2>
          <span className="today__hint">{data.upcoming.length} dated {data.upcoming.length === 1 ? "line" : "lines"} from today on</span>
        </div>
        <Card padding={data.upcoming.length ? "none" : "md"}>
          {data.upcoming.length === 0
            ? <EmptyState size="sm" title="Nothing scheduled" description="An interview lands here when its date is in the note: fill Interview on in the packet, or confirm a scheduling email on the Mail page." />
            : table(data.upcoming, "Coming up")}
        </Card>
      </section>

      {data.past.length > 0 && (
        <section className="today__section">
          <h2 className="today__heading">The last two weeks</h2>
          <Card padding="none">{table(data.past, "The last two weeks")}</Card>
        </section>
      )}

      <section className="today__section">
        <h2 className="today__heading">In your calendar app</h2>
        <Card padding="md">
          <div className="panel">
            <p className="muted">The same dates as a feed this machine serves. Apple Calendar: File, New Calendar Subscription, paste the address. Outlook: Add calendar, Subscribe from web. Google Calendar cannot reach this machine, so download the file above and import it there instead. Interviews with a time are timed events in your own time zone; the rest are all-day.</p>
            <CodeBlock code={feed} language="text" />
            <p className="muted">The feed answers while the TekJobs server is up (<code className="mono">tekjobs up</code>), and reads the notes every time, so a date you change in a note changes in the calendar at its next refresh.</p>
          </div>
        </Card>
      </section>

      <JobSheet id={selected} onClose={() => setSelected(null)} onChanged={() => load()} />
    </>
  );
}
