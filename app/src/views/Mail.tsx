import { Badge, Button, Card, EmptyState, Icon, Loader, Select, Table, toast } from "@/components/ui";
import { useEffect, useState } from "react";
import { api, type Job, type MailGroup, type MailItem, type MailState } from "../api";
import { JobSheet } from "./Jobs";

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
 * Mail: application emails the local CLI read from the mailbox, matched to notes. Nothing changes until a
 * person confirms an item; the model only extracted. The morning task reads on its own; Check mail is for
 * between-times.
 */
export function Mail() {
  const [selected, setSelected] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  return (
    <>
      <MailSays key={tick} onOpen={setSelected} onChanged={() => setTick((t) => t + 1)} />
      <JobSheet id={selected} onClose={() => setSelected(null)} onChanged={(job: Job) => { void job; }} />
    </>
  );
}

/** Today's one line about the mailbox: how many groups wait, and the way to the Mail page. The deciding happens there. */
export function MailStrip({ onOpen }: { onOpen: () => void }) {
  const [m, setM] = useState<MailState | null>(null);
  useEffect(() => { api.mail().then(setM).catch(() => {}); }, []);
  const n = m?.groups.length ?? 0;
  if (!m || (n === 0 && !m.running)) return null;
  return (
    <Card padding="md">
      <div className="mailstrip">
        <span>
          {m.running ? <><Loader size="sm" /> Reading the mailbox.</> : <><b className="num">{n}</b> {n === 1 ? "email group waits" : "email groups wait"} for a decision.</>}
          {m.lastRun && <span className="muted"> Last read <span className="num">{m.lastRun.slice(0, 16).replace("T", " ")}</span> UTC.</span>}
        </span>
        <Button size="sm" variant="soft" tone="primary" leadingIcon={<Icon.Mail />} onClick={onOpen}>Open Mail</Button>
      </div>
    </Card>
  );
}

export function MailSays({ onOpen, onChanged }: { onOpen: (id: string) => void; onChanged: () => void }) {
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
    <section className="today__section" id="mail-says">
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
          <EmptyState size="sm" title={m?.lastRun ? "Nothing waiting from the mailbox" : "The mailbox has not been read yet"} description={m?.error ? m.error : "The morning task reads application emails through your signed-in CLI (Gmail read tools only) and lists what they say about your applications here. You confirm each one. Check mail reads again now."} />
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
