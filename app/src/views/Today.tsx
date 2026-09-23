import { Badge, Button, Card, EmptyState, Icon, Loader, Menu, Select, Skeleton, Table, toast } from "@/components/ui";
import { useEffect, useState } from "react";
import { isPosted, PostedMark } from "@/components/PostedMark";
import { api, BAND_TONE, daysAgo, PASS_REASONS, shortPay, type Job, type MailGroup, type MailItem, type MailState, type PassReason, type Today as TodayData, type TodayRow } from "../api";

import { MailStrip } from "./Mail";
import { JobSheet } from "./Jobs";
import type { Page } from "../components/Shell";

/**
 * The queue, not the inventory.
 *
 * Measured on this vault: every listing that closed did so within seven days of being found, median two.
 * A match nobody looks at is perishable, so the page leads with the few worth deciding on and then shows
 * what is about to go, and what already went while it sat unread.
 */
export function Today({ onNavigate }: { onNavigate: (page: Page, q?: string) => void }) {
  const [data, setData] = useState<TodayData | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => api.today().then(setData).catch((e: Error) => setError(e.message));
  useEffect(() => { load(); }, []);

  const decide = async (row: TodayRow, status: "reviewing" | "passed", reason?: PassReason) => {
    setBusy(row.id);
    try {
      await api.setStatus(row.id, status, reason);
      toast({ title: `${row.company}: ${status === "reviewing" ? "shortlisted" : "passed"}`, description: reason, tone: status === "reviewing" ? "success" : "neutral" });
      await load();
    } catch (e) {
      toast({ title: "Not saved", description: (e as Error).message, tone: "danger" });
    } finally {
      setBusy(null);
    }
  };

  if (error) return <Card padding="md"><p className="muted">The server is not answering: {error}. Start it with <code>npm run server</code>.</p></Card>;
  if (!data) return <Skeleton variant="rect" height="18rem" />;

  const { counts, sections } = data;
  const inFlight = [...sections.preparing, ...sections.followUps, ...sections.interviewing];

  return (
    <>
      <div className="page__head">
        <div>
          <h1 className="today__date">{new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}</h1>
          <p>
            {sections.triage.length === 0
              ? "Today's queue is clear. The next scan refills it."
              : `${sections.triage.length === 1 ? "One" : sections.triage.length} to decide on, best fit first. The other ${counts.unreviewed - sections.triage.length} unreviewed wait in Jobs and do not count against you. Fit is the share of the ${data.ceiling} points this criteria set can award.`}
          </p>
        </div>
        <Button variant="soft" size="sm" onClick={() => onNavigate("jobs")}>See all matches</Button>
      </div>

      <div className="today__figures">
        <div className="today__figure"><b>{counts.open}</b><small>open</small></div>
        <div className="today__figure"><b>{counts.aging}</b><small>waiting 2d+</small></div>
        <div className="today__figure"><b data-tone={counts.closedUnreviewed > 0 ? "danger" : undefined}>{counts.closedUnreviewed}</b><small>closed unseen</small></div>
      </div>

      <section className="today__section">
        <div className="today__section-head">
          <h2 className="today__heading">Decide on these</h2>
          <span className="today__hint">shortlist · pass · open sheet</span>
        </div>
        {sections.triage.length === 0 ? (
          <Card padding="md">
            <EmptyState size="sm" title="Inbox clear" description="Nothing unreviewed is open right now. The next scan will refill this." />
          </Card>
        ) : (
          <Card padding="none">
            <Table aria-label="Matches to decide on" density="md">
              <Table.Head>
                <Table.Row>
                  <Table.HeadCell align="end" numeric>Fit</Table.HeadCell>
                  <Table.HeadCell>Company</Table.HeadCell>
                  <Table.HeadCell>Role</Table.HeadCell>
                  <Table.HeadCell>Pay</Table.HeadCell>
                  <Table.HeadCell>Found</Table.HeadCell>
                  <Table.HeadCell>Decide</Table.HeadCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {sections.triage.map((r) => (
                  <Table.Row key={r.id} interactive data-posted={isPosted(r.source) || undefined} selected={selected === r.id} onClick={() => setSelected(r.id)}>
                    <Table.Cell align="end" numeric><Fit value={r.fit} /></Table.Cell>
                    <Table.Cell><span className="posted-co">{r.company}{isPosted(r.source) && <PostedMark />}</span></Table.Cell>
                    <Table.Cell>
                      <div className="who__text">
                        {r.title}
                        {r.kind === "design-eng" && <small>design engineering</small>}
                      </div>
                    </Table.Cell>
                    <Table.Cell>{r.salaryMax > 0 ? <Badge tone={BAND_TONE[r.payBand]} size="sm">{shortPay(r.salary)}</Badge> : <span className="muted">—</span>}</Table.Cell>
                    <Table.Cell><span className="muted">{daysAgo(r.found)}</span></Table.Cell>
                    <Table.Cell>
                      <div className="today__actions" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="soft" tone="primary" disabled={busy === r.id} onClick={() => decide(r, "reviewing")}>Shortlist</Button>
                        <Menu>
                          <Menu.Trigger asChild>
                            <Button size="sm" variant="ghost" disabled={busy === r.id} trailingIcon={<Icon.ChevronDown />}>Pass</Button>
                          </Menu.Trigger>
                          <Menu.Content align="end">
                            {PASS_REASONS.map((reason) => (
                              <Menu.Item key={reason} onSelect={() => decide(r, "passed", reason)}>{reason}</Menu.Item>
                            ))}
                          </Menu.Content>
                        </Menu>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </Card>
        )}
      </section>

      <MailStrip onOpen={() => onNavigate("mail")} />

      {sections.started.length > 0 && (
        <section className="today__section">
          <h2 className="today__heading">Already started</h2>
          <Card padding="none">
            <Table aria-label="Applications with a packet started" density="md">
              <Table.Head>
                <Table.Row>
                  <Table.HeadCell align="end" numeric>Fit</Table.HeadCell>
                  <Table.HeadCell>Company</Table.HeadCell>
                  <Table.HeadCell>Role</Table.HeadCell>
                  <Table.HeadCell>Packet</Table.HeadCell>
                  <Table.HeadCell>Pay</Table.HeadCell>
                  <Table.HeadCell>Status</Table.HeadCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {sections.started.map((r) => (
                  <Table.Row key={r.id} interactive data-posted={isPosted(r.source) || undefined} selected={selected === r.id} onClick={() => setSelected(r.id)}>
                    <Table.Cell align="end" numeric><Fit value={r.fit} /></Table.Cell>
                    <Table.Cell><span className="posted-co">{r.company}{isPosted(r.source) && <PostedMark />}</span></Table.Cell>
                    <Table.Cell>{r.title}</Table.Cell>
                    <Table.Cell><Badge size="sm" tone="primary" variant="soft">{r.packet} filled</Badge></Table.Cell>
                    <Table.Cell>{r.salaryMax > 0 ? <Badge tone={BAND_TONE[r.payBand]} size="sm">{shortPay(r.salary)}</Badge> : <span className="muted">—</span>}</Table.Cell>
                    <Table.Cell>
                      {r.closed
                        ? <Badge size="sm" tone="danger">closed {r.closed}</Badge>
                        : <Badge size="sm" tone={r.status === "ready" ? "warning" : "neutral"}>{r.status}</Badge>}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </Card>
          <p className="muted">
            Work you have already put in, wherever it ranks. The fit score knows nothing about a drafted packet,
            so these would otherwise fall off the bottom of the queue.
          </p>
        </section>
      )}

      {(sections.aging.length > 0 || sections.missed.length > 0) && (
        <section className="today__section">
          <h2 className="today__heading">Going, and gone</h2>
          <div className="today__cols">
            {sections.aging.length > 0 && (
              <Card padding="md">
                <h3 className="today__subheading">Still open, still unread</h3>
                <p className="muted">Listings here close after two days, at the median.</p>
                <ul className="today__list">
                  {sections.aging.map((r) => (
                    <li key={r.id}>
                      <Button className="today__row" variant="ghost" align="start" size="sm" onClick={() => setSelected(r.id)}>
                        <Fit value={r.fit} />
                        <span className="today__row-text">{summarise(r.company, r.title, 52)}</span>
                        <Badge size="sm" tone={(r.days ?? 0) >= 5 ? "danger" : "warning"} variant="outline">{r.days}d</Badge>
                      </Button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {sections.missed.length > 0 && (
              <Card padding="md">
                <h3 className="today__subheading">Closed before you saw them</h3>
                <p className="muted">{counts.closedUnreviewed} this week. This is what the queue costs when it is skipped.</p>
                <ul className="today__list">
                  {sections.missed.map((r) => (
                    <li key={r.id}>
                      <Button className="today__row" variant="ghost" align="start" size="sm" onClick={() => setSelected(r.id)}>
                        <Fit value={r.fit} />
                        <span className="today__row-text">{summarise(r.company, r.title, 36)}</span>
                        <span className="muted">{r.closed}</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </section>
      )}

      <section className="today__section">
        <h2 className="today__heading">In flight</h2>
        <Card padding={inFlight.length ? "none" : "md"}>
          {inFlight.length === 0 ? (
            <EmptyState
              size="sm"
              title="Nothing in flight"
              description="Applications being prepared, follow-ups that are due, and interviews appear here once jobs move past Shortlisted."
              action={<Button size="sm" variant="ghost" onClick={() => onNavigate("pipeline")}>Open the pipeline</Button>}
            />
          ) : (
            <Table aria-label="In flight" density="md">
              <Table.Head>
                <Table.Row>
                  <Table.HeadCell align="end" numeric>Fit</Table.HeadCell>
                  <Table.HeadCell>Company</Table.HeadCell>
                  <Table.HeadCell>Role</Table.HeadCell>
                  <Table.HeadCell>Status</Table.HeadCell>
                  <Table.HeadCell>Due</Table.HeadCell>
                  <Table.HeadCell>Write to</Table.HeadCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {inFlight.map((r) => (
                  <Table.Row key={r.id} interactive data-posted={isPosted(r.source) || undefined} onClick={() => setSelected(r.id)}>
                    <Table.Cell align="end" numeric><Fit value={r.fit} /></Table.Cell>
                    <Table.Cell><span className="posted-co">{r.company}{isPosted(r.source) && <PostedMark />}</span></Table.Cell>
                    <Table.Cell>{r.title}</Table.Cell>
                    <Table.Cell><Badge size="sm" tone="primary">{r.status}</Badge></Table.Cell>
                    <Table.Cell>{r.due || <span className="muted">—</span>}</Table.Cell>
                    <Table.Cell><WriteTo contact={r.contact} /></Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
        </Card>
      </section>

      <section className="today__section">
        <div className="today__section-head">
          <h2 className="today__heading">Waiting on a reply</h2>
          <span className="today__hint">applied {counts.waitingDays}d+ ago, nothing back · {counts.waiting} in all</span>
        </div>
        <Card padding={sections.waiting.length === 0 ? "md" : "none"}>
          {sections.waiting.length === 0 ? (
            <EmptyState size="sm" title="Nothing has gone quiet" description={`Applications with no answer after ${counts.waitingDays} days land here, with the person to ask.`} />
          ) : (
            <Table aria-label="Applications waiting on a reply" density="md">
              <Table.Head>
                <Table.Row>
                  <Table.HeadCell align="end" numeric>Days</Table.HeadCell>
                  <Table.HeadCell>Company</Table.HeadCell>
                  <Table.HeadCell>Role</Table.HeadCell>
                  <Table.HeadCell>Applied</Table.HeadCell>
                  <Table.HeadCell>Write to</Table.HeadCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {sections.waiting.map((r) => (
                  <Table.Row key={r.id} interactive data-posted={isPosted(r.source) || undefined} onClick={() => setSelected(r.id)}>
                    <Table.Cell align="end" numeric><span className="num" data-tone={(r.days ?? 0) >= 21 ? "danger" : undefined}>{r.days}</span></Table.Cell>
                    <Table.Cell><span className="posted-co">{r.company}{isPosted(r.source) && <PostedMark />}</span></Table.Cell>
                    <Table.Cell>{r.title}</Table.Cell>
                    <Table.Cell><span className="num muted">{r.appliedOn}</span></Table.Cell>
                    <Table.Cell><WriteTo contact={r.contact} /></Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
        </Card>
      </section>

      <JobSheet id={selected} onClose={() => setSelected(null)} onChanged={(job: Job) => { void job; load(); }} />
    </>
  );
}

/**
 * A one-line summary of a row, clamped.
 *
 * Aggregator feeds sometimes put an entire posting in the title field — one here runs to 150 characters,
 * pay and location included. CSS ellipsis cannot save it, because Button lays its label out as a block that
 * will not shrink, and reaching into the component's internals to change that is the thing the design system
 * exists to stop. The full title is a click away in the sheet.
 */
const summarise = (company: string, title: string, max = 64) => {
  const line = `${company} — ${title}`.replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
};

/** The person to write to about a thread, or the nudge to find one. A mailto opens the mail client; nothing is sent here. */
function WriteTo({ contact }: { contact?: TodayRow["contact"] }) {
  if (!contact) return <span className="muted" title="Open the sheet's People tab to add someone.">no one on the thread</span>;
  return (
    <span className="who__text">
      {contact.email ? <a className="people__thread" href={`mailto:${contact.email}`} onClick={(e) => e.stopPropagation()}>{contact.name} ↗</a> : contact.name}
      <small>{contact.role || "contact"}{contact.others > 0 ? ` · +${contact.others}` : ""}</small>
    </span>
  );
}

/** Fit reads as a share of what was available, so the number needs a scale beside it, not just a colour. */
function Fit({ value }: { value: number }) {
  return (
    <Badge size="sm" tone={value >= 80 ? "success" : value >= 60 ? "primary" : "neutral"} variant={value >= 60 ? "soft" : "outline"}>
      <span className="num">{value}</span>
    </Badge>
  );
}
