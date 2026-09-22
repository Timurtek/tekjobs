import { Badge, Button, Card, EmptyState, Icon, Loader, Menu, Select, Skeleton, Table, toast } from "@/components/ui";
import { useEffect, useState } from "react";
import { api, BAND_TONE, daysAgo, PASS_REASONS, shortPay, type Job, type MailGroup, type MailItem, type MailState, type PassReason, type Today as TodayData, type TodayRow } from "../api";

const KIND_TONE: Record<MailItem["kind"], "success" | "danger" | "primary" | "warning" | "neutral"> = { confirmation: "success", rejection: "danger", advance: "primary", scheduling: "primary", "info-request": "warning", other: "neutral" };
const KIND_LABEL: Record<MailItem["kind"], string> = { confirmation: "confirmed", rejection: "rejected", advance: "advanced", scheduling: "scheduling", "info-request": "asks for more", other: "other" };

/** What confirming this item does, in words. */
function meaning(i: MailGroup, noteId: string) {
  const s = i.suggestion;
  if (!noteId) return `create a note for ${i.company} and mark it ${s.status}`;
  if (s.action === "status") return `mark it ${s.status}${s.appliedOn ? ` as of ${s.appliedOn}` : ""}`;
  return `add the mail to the note${s.appliedOn ? ", set Applied on if empty" : ""}`;
}

/**
 * "Mail says": application emails the local CLI read from the mailbox, matched to notes. Nothing changes until
 * a person confirms an item; the model only extracted.
 */
function MailSays({ onOpen, onChanged }: { onOpen: (id: string) => void; onChanged: () => void }) {
  const [m, setM] = useState<MailState | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => api.mail().then(setM).catch(() => {});
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!m?.running) return;
    const t = setInterval(() => api.mail().then((s) => { setM(s); if (!s.running && s.error) toast({ title: "Mail check failed", description: s.error, tone: "danger" }); }).catch(() => {}), 4000);
    return () => clearInterval(t);
  }, [m?.running]);

  const check = async () => {
    try { setM(await api.mailCheck()); toast({ title: "Reading the mailbox", description: "Through the local CLI, Gmail read tools only. A few minutes.", tone: "neutral" }); }
    catch (e) { toast({ title: "Could not start", description: (e as Error).message, tone: "danger" }); }
  };
  const act = async (i: MailGroup, what: "confirm" | "dismiss") => {
    setBusy(i.id);
    try {
      const chosen = i.id in picks ? picks[i.id] : i.noteId;
      setM(what === "confirm" ? await api.mailConfirm(i.id, chosen || undefined) : await api.mailDismiss(i.id));
      if (what === "confirm") { toast({ title: `${i.company}: ${meaning(i, picks[i.id] || i.noteId)}`, description: "Written to the note.", tone: "success" }); onChanged(); }
    } catch (e) { toast({ title: "Not saved", description: (e as Error).message, tone: "danger" }); }
    finally { setBusy(null); }
  };

  const pending = m?.groups ?? [];
  const handled = (m?.items ?? []).filter((i) => i.state !== "pending").sort((a, b) => (b.resolved?.at ?? "").localeCompare(a.resolved?.at ?? ""));
  const done = handled.length;
  const [showHandled, setShowHandled] = useState(false);
  const did = (i: MailItem) => i.state === "dismissed" ? "dismissed" : i.resolved?.action === "create" ? `note created, marked ${i.resolved.status}` : i.resolved?.action === "status" ? `marked ${i.resolved.status}` : "recorded on the note";
  const safe = pending.filter((g) => g.kind === "confirmation" && g.match === "exact" && g.noteId).length;
  const confirmSafe = async () => {
    setBusy("safe");
    try { const r = await api.mailConfirmSafe(); setM(r); toast({ title: `${r.confirmed} confirmations recorded`, description: "Exact-title matches only. The rest are still listed.", tone: "success" }); onChanged(); }
    catch (e) { toast({ title: "Not saved", description: (e as Error).message, tone: "danger" }); }
    finally { setBusy(null); }
  };
  return (
    <section className="today__section">
      <div className="panel__head">
        <h2 className="today__heading">Mail says</h2>
        <div className="pager__buttons">
          {m?.lastRun && <span className="muted">last read {m.lastRun.slice(0, 16).replace("T", " ")} UTC, {m.lastSinceDays} days back</span>}
          {done > 0 && <Button size="sm" variant="ghost" onClick={() => setShowHandled((v) => !v)}>{showHandled ? "Hide handled" : `${done} handled`}</Button>}
          {safe > 0 && <Button size="sm" variant="soft" tone="primary" disabled={busy === "safe" || !!m?.running} loading={busy === "safe"} title="Confirmations whose note matched by exact title: records the mail, marks still-open notes applied as of the mail's date. Rejections, interviews, company-only matches and creates stay one at a time." onClick={confirmSafe}>Confirm the exact matches ({safe})</Button>}
          <Button size="sm" variant="soft" disabled={!!m?.running} leadingIcon={m?.running ? <Loader size="sm" /> : <Icon.Mail />} onClick={check}>{m?.running ? "Reading the mailbox" : "Check mail"}</Button>
        </div>
      </div>
      {!m || (pending.length === 0 && !m.running) ? (
        <Card padding="md">
          <EmptyState size="sm" title={m?.lastRun ? "Nothing waiting from the mailbox" : "The mailbox has not been read yet"} description={m?.error ? m.error : "Check mail reads application emails through your signed-in CLI (Gmail read tools only) and lists what they say about your applications here. You confirm each one."} />
        </Card>
      ) : (
        <Card padding="none">
          <Table aria-label="Application emails waiting for a decision" density="md">
            <Table.Head>
              <Table.Row>
                <Table.HeadCell>Date</Table.HeadCell>
                <Table.HeadCell>Mail says</Table.HeadCell>
                <Table.HeadCell>Company and role</Table.HeadCell>
                <Table.HeadCell>Note</Table.HeadCell>
                <Table.HeadCell>Confirm</Table.HeadCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {pending.map((i) => {
                const target = picks[i.id] || i.noteId;
                return (
                  <Table.Row key={i.id}>
                    <Table.Cell><span className="muted">{i.date || "—"}</span></Table.Cell>
                    <Table.Cell>
                      <div className="who__text">
                        <span className="chips">
                          {i.kinds.map((k) => <Badge key={k} size="sm" tone={KIND_TONE[k]}>{KIND_LABEL[k]}</Badge>)}
                          {i.count > 1 && <small>{i.count} emails{i.first && i.first !== i.date ? `, ${i.first} to ${i.date}` : ""}</small>}
                        </span>
                        <small title={i.subject}>{i.gist}</small>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="who__text">
                        {i.company}
                        <small>{i.role || "role not stated"}</small>
                        {i.person && <small title={`${i.person.email}. Confirming adds them to People and to the note.`}>from {i.person.name}</small>}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      {i.match === "none" ? (
                        <span className="muted">no note; confirm creates one</span>
                      ) : i.match === "exact" || (i.match === "company" && i.candidates.length <= 1) ? (
                        <Button variant="link" size="sm" tone="neutral" onClick={() => onOpen(i.noteId)}>{i.noteTitle} · {i.noteStatus}</Button>
                      ) : (
                        <Select size="sm" label={i.match === "company-other-role" ? "Not a role in the vault" : "Which role"} value={target || "__new__"} onValueChange={(v) => setPicks((p) => ({ ...p, [i.id]: v === "__new__" ? "" : v }))}>
                          <Select.Item value="__new__">New note for this role</Select.Item>
                          {i.candidates.map((c) => (
                            <Select.Item key={c.id} value={c.id}>{c.title} · {c.status}</Select.Item>
                          ))}
                        </Select>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="today__actions">
                        <Button size="sm" variant="soft" tone="primary" disabled={busy === i.id} title={meaning(i, target)} onClick={() => act(i, "confirm")}>{!target ? "Create and mark" : i.suggestion.action === "record" ? "Record" : `Mark ${i.suggestion.status}`}</Button>
                        <Button size="sm" variant="ghost" disabled={busy === i.id} onClick={() => act(i, "dismiss")}>Dismiss</Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
              {m.running && pending.length === 0 && (
                <Table.Row><Table.Cell colSpan={5}><span className="muted">Reading…</span></Table.Cell></Table.Row>
              )}
            </Table.Body>
          </Table>
        </Card>
      )}
      {showHandled && (
        <Card padding="none">
          <Table aria-label="Application emails already handled" density="md">
            <Table.Head>
              <Table.Row>
                <Table.HeadCell>Mail date</Table.HeadCell>
                <Table.HeadCell>Mail said</Table.HeadCell>
                <Table.HeadCell>Company and role</Table.HeadCell>
                <Table.HeadCell>Note</Table.HeadCell>
                <Table.HeadCell>What was done</Table.HeadCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {handled.map((i) => (
                <Table.Row key={i.id}>
                  <Table.Cell><span className="muted">{i.date || "—"}</span></Table.Cell>
                  <Table.Cell><Badge size="sm" tone={KIND_TONE[i.kind]}>{KIND_LABEL[i.kind]}</Badge></Table.Cell>
                  <Table.Cell>
                    <div className="who__text">
                      {i.company}
                      <small>{i.role || "role not stated"}</small>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {i.noteId ? <Button variant="link" size="sm" tone="neutral" onClick={() => onOpen(i.noteId)}>{i.noteId.replace(/ \([0-9a-f]+\)$/, "")}</Button> : <span className="muted">—</span>}
                  </Table.Cell>
                  <Table.Cell><span className="muted">{did(i)}{i.resolved?.at ? `, ${i.resolved.at.slice(0, 16).replace("T", " ")} UTC` : ""}</span></Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Card>
      )}
    </section>
  );
}
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
                  <Table.Row key={r.id} interactive selected={selected === r.id} onClick={() => setSelected(r.id)}>
                    <Table.Cell align="end" numeric><Fit value={r.fit} /></Table.Cell>
                    <Table.Cell>{r.company}</Table.Cell>
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

      <MailSays onOpen={(id) => setSelected(id)} onChanged={load} />

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
                  <Table.Row key={r.id} interactive selected={selected === r.id} onClick={() => setSelected(r.id)}>
                    <Table.Cell align="end" numeric><Fit value={r.fit} /></Table.Cell>
                    <Table.Cell>{r.company}</Table.Cell>
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
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {inFlight.map((r) => (
                  <Table.Row key={r.id} interactive onClick={() => setSelected(r.id)}>
                    <Table.Cell align="end" numeric><Fit value={r.fit} /></Table.Cell>
                    <Table.Cell>{r.company}</Table.Cell>
                    <Table.Cell>{r.title}</Table.Cell>
                    <Table.Cell><Badge size="sm" tone="primary">{r.status}</Badge></Table.Cell>
                    <Table.Cell>{r.due || <span className="muted">—</span>}</Table.Cell>
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

/** Fit reads as a share of what was available, so the number needs a scale beside it, not just a colour. */
function Fit({ value }: { value: number }) {
  return (
    <Badge size="sm" tone={value >= 80 ? "success" : value >= 60 ? "primary" : "neutral"} variant={value >= 60 ? "soft" : "outline"}>
      <span className="num">{value}</span>
    </Badge>
  );
}
