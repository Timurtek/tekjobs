import { Badge, Button, Card, CodeBlock, EmptyState, Icon, Loader, Select, Skeleton, Table, toast } from "@/components/ui";
import { useEffect, useState } from "react";
import { api, type Calendar as CalendarData, type CalendarCheckItem, type CalendarCheckState, type CalendarEvent } from "../api";
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

      <FromGoogleCalendar onChanged={load} />

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

const CHECK_KIND: Record<CalendarCheckItem["kind"], string> = { interview: "Interview", screen: "Screen", onsite: "Onsite", "offer-call": "Offer call", "recruiter-call": "Recruiter call", deadline: "Deadline", other: "Event" };

/**
 * The other direction: events already on the person's Google Calendar, read through the local CLI's connector
 * with its read tools only, each matched to a note and waiting for a decision. Confirming writes the time into
 * the note; nothing is written to the calendar.
 */
function FromGoogleCalendar({ onChanged }: { onChanged: () => void }) {
  const [c, setC] = useState<CalendarCheckState | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => api.calendarItems().then(setC).catch(() => setC(null));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!c?.running) return;
    const t = setInterval(() => api.calendarItems().then((s) => { setC(s); if (!s.running && s.error) toast({ title: "Calendar check failed", description: s.error, tone: "danger" }); }).catch(() => {}), 4000);
    return () => clearInterval(t);
  }, [c?.running]);
  const check = async () => {
    try { setC(await api.calendarCheck()); toast({ title: "Reading the calendar", description: "Through the local CLI, Google Calendar read tools only. A minute or two.", tone: "neutral" }); }
    catch (e) { toast({ title: "Could not start", description: (e as Error).message, tone: "danger" }); }
  };
  const act = async (i: CalendarCheckItem, what: "confirm" | "dismiss") => {
    setBusy(i.id);
    try {
      const chosen = i.id in picks ? picks[i.id] : i.noteId;
      setC(what === "confirm" ? await api.calendarConfirm(i.id, chosen || undefined) : await api.calendarDismiss(i.id));
      if (what === "confirm") { toast({ title: `${i.company}: ${i.suggestion.text}`, description: "Written to the note.", tone: "success" }); onChanged(); }
    } catch (e) { toast({ title: "Not saved", description: (e as Error).message, tone: "danger" }); }
    setBusy(null);
  };
  if (!c) return null;
  return (
    <section className="today__section">
      <div className="today__section-head">
        <h2 className="today__heading">From your Google Calendar</h2>
        <span className="today__hint">{c.lastRun ? `last read ${c.lastRun.slice(0, 16).replace("T", " ")} UTC` : "not read yet"}</span>
      </div>
      <Card padding="md">
        <div className="panel">
          <p className="muted">Interviews and calls already on your calendar, read through the local CLI&apos;s Google Calendar connector with its read tools only, matched to your notes. Each event opens in Google Calendar from its title. You confirm each one here; confirming puts the time into the note&apos;s Interview on field and moves a note that is not yet interviewing. Nothing is ever written to the calendar. Needs Claude Code with the Google Calendar connector enabled.</p>
          <div className="form__actions form__actions--start">
            <Button size="sm" variant="soft" tone="primary" loading={c.running} disabled={c.running} onClick={check}>{c.running ? "Reading the calendar" : "Check Google Calendar"}</Button>
            {c.running && <Loader size="sm" />}
            {c.error && !c.running && <span className="muted">Last check failed ({c.errorKind}): {c.error}</span>}
          </div>
          {c.pending.length === 0 ? (
            <p className="muted">{c.lastRun ? "Nothing waiting: every event found has been confirmed or dismissed." : ""}</p>
          ) : (
            <Table aria-label="Calendar events waiting for a decision" density="md">
              <Table.Head>
                <Table.Row>
                  <Table.HeadCell>When</Table.HeadCell>
                  <Table.HeadCell>Event</Table.HeadCell>
                  <Table.HeadCell>Note</Table.HeadCell>
                  <Table.HeadCell>Confirming</Table.HeadCell>
                  <Table.HeadCell>Decide</Table.HeadCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {c.pending.map((i) => (
                  <Table.Row key={i.id}>
                    <Table.Cell><span className="num">{i.start}</span></Table.Cell>
                    <Table.Cell>
                      <div className="who__text">
                        <span><Badge size="sm" tone="primary" variant="soft">{CHECK_KIND[i.kind]}</Badge> {i.company}{i.role ? ` · ${i.role}` : ""}</span>
                        <small><a className="people__thread" href={i.link} target="_blank" rel="noreferrer">{i.summary || "the event"} ↗</a>{i.with ? ` · with ${i.with}` : ""}</small>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      {i.candidates.length > 1 ? (
                        <Select size="sm" aria-label="Which note" value={(i.id in picks ? picks[i.id] : i.noteId) || "none"} onValueChange={(v) => setPicks({ ...picks, [i.id]: v === "none" ? "" : v })}>
                          <Select.Item value="none">No note</Select.Item>
                          {i.candidates.map((n) => <Select.Item key={n.id} value={n.id}>{n.title} ({n.status})</Select.Item>)}
                        </Select>
                      ) : i.noteId ? <span className="muted">{i.noteTitle} ({i.noteStatus})</span> : <span className="muted">no note at {i.company}</span>}
                    </Table.Cell>
                    <Table.Cell><span className="muted">{i.suggestion.text}</span></Table.Cell>
                    <Table.Cell>
                      <div className="today__actions">
                        <Button size="sm" variant="soft" tone="primary" disabled={busy === i.id} onClick={() => act(i, "confirm")}>Confirm</Button>
                        <Button size="sm" variant="ghost" disabled={busy === i.id} onClick={() => act(i, "dismiss")}>Dismiss</Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
        </div>
      </Card>
    </section>
  );
}

/** On Today: how many calendar events wait for a decision, with the way to them. Nothing when there are none and no run is going. */
export function CalendarStrip({ onOpen }: { onOpen: () => void }) {
  const [c, setC] = useState<CalendarCheckState | null>(null);
  useEffect(() => { api.calendarItems().then(setC).catch(() => {}); }, []);
  const n = c?.pending.length ?? 0;
  if (!c || (n === 0 && !c.running)) return null;
  return (
    <Card padding="md">
      <div className="mailstrip">
        <span>
          {c.running ? <><Loader size="sm" /> Reading the calendar.</> : <><b className="num">{n}</b> calendar {n === 1 ? "event waits" : "events wait"} for a decision.</>}
          {c.lastRun && <span className="muted"> Last read <span className="num">{c.lastRun.slice(0, 16).replace("T", " ")}</span> UTC.</span>}
        </span>
        <Button size="sm" variant="soft" tone="primary" leadingIcon={<Icon.Calendar />} onClick={onOpen}>Open Calendar</Button>
      </div>
    </Card>
  );
}
