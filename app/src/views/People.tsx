import { Badge, Button, Card, Dialog, EmptyState, Icon, Markdown, Select, Sheet, Skeleton, Table, TextArea, TextField, toast } from "@/components/ui";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api, daysAgo, PERSON_ROLES, STATUS_TONE, type Job, type JobPerson, type Person, type PersonDetail, type PersonRole, type Status } from "../api";

const ROLE_LABEL: Record<PersonRole, string> = { recruiter: "recruiter", "hiring-manager": "hiring manager", interviewer: "interviewer", referral: "referral", other: "contact" };
const ROLE_TONE: Record<PersonRole, "primary" | "success" | "warning" | "neutral"> = { recruiter: "primary", "hiring-manager": "warning", interviewer: "neutral", referral: "success", other: "neutral" };
const roleOf = (r: string): PersonRole => (PERSON_ROLES as readonly string[]).includes(r) ? (r as PersonRole) : "other";

/**
 * People: the recruiters, hiring managers, interviewers and referrals the search has met. One note each under
 * People/, linked from the job notes they are on. Most arrive from the mail check, when a human wrote; the
 * rest are added here or on a job sheet.
 */
export function People() {
  const [rows, setRows] = useState<Person[] | null>(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const load = () => api.people().then(setRows).catch((e: Error) => toast({ title: "Could not load people", description: e.message, tone: "danger" }));
  useEffect(() => { load(); }, []);
  const visible = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return (rows ?? []).filter((p) => (role === "all" || p.role === role) && (!ql || `${p.name} ${p.company} ${p.email}`.toLowerCase().includes(ql)));
  }, [rows, q, role]);

  return (
    <>
      <div className="toolbar">
        <TextField className="toolbar__search" size="sm" label="Search" placeholder="Name, company or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select className="toolbar__filter" size="sm" label="Role" value={role} onValueChange={setRole}>
          <Select.Item value="all">Everyone</Select.Item>
          {PERSON_ROLES.map((r) => (
            <Select.Item key={r} value={r}>{ROLE_LABEL[r]}</Select.Item>
          ))}
        </Select>
        <span className="toolbar__spacer" />
        <AddPerson onAdded={(p) => { load(); setSelected(p.id); }} />
      </div>

      <Card padding="none">
        {rows === null ? (
          <div className="loading"><Skeleton lines={6} /></div>
        ) : rows.length === 0 ? (
          <EmptyState size="sm" title="No people yet" description="Confirming an email that a person wrote adds them here, with the thread. Or add someone: a recruiter who reached out, a referral, the hiring manager you met." />
        ) : (
          <Table aria-label="People" density="md" stickyHeader>
            <Table.Head>
              <Table.Row>
                <Table.HeadCell>Name</Table.HeadCell>
                <Table.HeadCell>Role</Table.HeadCell>
                <Table.HeadCell>Company</Table.HeadCell>
                <Table.HeadCell>Email</Table.HeadCell>
                <Table.HeadCell>Last contact</Table.HeadCell>
                <Table.HeadCell>Threads</Table.HeadCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {visible.map((p) => (
                <Table.Row key={p.id} interactive selected={selected === p.id} onClick={() => setSelected(p.id)}>
                  <Table.Cell>{p.name}</Table.Cell>
                  <Table.Cell><Badge size="sm" tone={ROLE_TONE[roleOf(p.role)]} variant="soft">{ROLE_LABEL[roleOf(p.role)]}</Badge></Table.Cell>
                  <Table.Cell>{p.company || <span className="muted">—</span>}</Table.Cell>
                  <Table.Cell><span className="num muted">{p.email || "—"}</span></Table.Cell>
                  <Table.Cell><span className="num">{p.lastContact ? `${p.lastContact} · ${daysAgo(p.lastContact)}` : "—"}</span></Table.Cell>
                  <Table.Cell>
                    <span className="num">{p.threads.length}</span>{p.live > 0 && <span className="muted"> · {p.live} live</span>}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Card>
      <p className="muted">{visible.length} of {rows?.length ?? 0} people. Notes live in <code className="mono">People/</code>; a job note lists its people under <code className="mono">## People</code>.</p>
      <PersonSheet id={selected} onClose={() => setSelected(null)} onChanged={load} />
    </>
  );
}

/** Add a person from the People page: no job attached; that happens on the job sheet or from mail. */
function AddPerson({ onAdded, job }: { onAdded: (p: PersonDetail) => void; job?: Job }) {
  const [open, setOpen] = useState(false);
  const blank = { name: "", role: "recruiter" as PersonRole, company: job?.company ?? "", email: "", links: "", about: "" };
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const p = await api.addPerson({ ...form, jobId: job?.id });
      setOpen(false); setForm(blank);
      toast({ title: `${p.name} ${p.created === new Date().toISOString().slice(0, 10) ? "added" : "recognised"}`, description: job ? `On ${job.company} - ${job.title}.` : `People/${p.id}.md`, tone: "success" });
      onAdded(p);
    } catch (err) { toast({ title: "Not added", description: (err as Error).message, tone: "danger" }); }
    setBusy(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen} size="sm">
      <Dialog.Trigger asChild>
        <Button tone="primary" size="sm" leadingIcon={<Icon.Plus />}>Add a person</Button>
      </Dialog.Trigger>
      <Dialog.Content>
        <form className="form" onSubmit={submit}>
          <Dialog.Title>{job ? `Someone on ${job.company}` : "Add a person"}</Dialog.Title>
          <Dialog.Description>A note under People/. Someone already there, by email or by name at the same company, is recognised rather than duplicated.</Dialog.Description>
          <TextField label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="form__row">
            <Select label="Role" value={form.role} onValueChange={(v) => setForm({ ...form, role: v as PersonRole })}>
              {PERSON_ROLES.map((r) => (
                <Select.Item key={r} value={r}>{ROLE_LABEL[r]}</Select.Item>
              ))}
            </Select>
            <TextField label="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <TextField label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <TextField label="Links" description="LinkedIn or anything else, as text." value={form.links} onChange={(e) => setForm({ ...form, links: e.target.value })} />
          <TextField label="About" description="How you know them, in a line." value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} />
          <Dialog.Footer>
            <Dialog.Close asChild><Button variant="ghost">Cancel</Button></Dialog.Close>
            <Button type="submit" tone="primary" loading={busy}>Add</Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}

/** One person: who they are, the threads they are on, the log, and a way to add to it. */
function PersonSheet({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const [p, setP] = useState<PersonDetail | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setP(null);
    if (id) api.person(id).then(setP).catch((e: Error) => toast({ title: "Could not open the note", description: e.message, tone: "danger" }));
  }, [id]);
  const log = async () => {
    if (!p || !text.trim()) return;
    setBusy(true);
    try { setP(await api.logContact(p.id, text.trim())); setText(""); onChanged(); toast({ title: "Logged", description: `On People/${p.id}.md; last contact is today.`, tone: "success" }); }
    catch (e) { toast({ title: "Not saved", description: (e as Error).message, tone: "danger" }); }
    setBusy(false);
  };
  return (
    <Sheet open={id !== null} onOpenChange={(open) => !open && onClose()} side="right" size="md">
      <Sheet.Content>
        {!p ? (
          <div className="detail"><Skeleton lines={5} /></div>
        ) : (
          <div className="detail">
            <div className="sheet-head">
              <div className="sheet-head__main">
                <p className="sheet-head__meta">{p.company || "no company"}{p.created ? ` · since ${p.created}` : ""}</p>
                <Sheet.Title>{p.name}</Sheet.Title>
                <div className="chips">
                  <Badge size="sm" tone={ROLE_TONE[roleOf(p.role)]} variant="soft">{ROLE_LABEL[roleOf(p.role)]}</Badge>
                  {p.email && <Badge size="sm" tone="neutral" variant="outline"><span className="num">{p.email}</span></Badge>}
                  {p.lastContact && <Badge size="sm" tone="neutral" variant="outline">last contact <span className="num">{p.lastContact}</span></Badge>}
                </div>
              </div>
              <div className="sheet-head__side">
                <div className="sheet-head__links">
                  {p.email && (
                    <Button asChild variant="link" size="sm" tone="neutral">
                      <a href={`mailto:${p.email}`}>Write to them ↗</a>
                    </Button>
                  )}
                  <Button asChild variant="link" size="sm" tone="neutral">
                    <a href={p.obsidianUrl} title={p.path}>Open in Obsidian ↗</a>
                  </Button>
                </div>
              </div>
            </div>
            {(p.about || p.links) && (
              <div>
                <div className="microlabel">About</div>
                <p className="muted">{p.about}{p.links ? ` ${p.links}` : ""}</p>
              </div>
            )}
            <div>
              <div className="microlabel">Threads</div>
              {p.threads.length === 0 ? <p className="muted">On no job note yet.</p> : (
                <ul className="people__threads">
                  {p.threads.map((t) => (
                    <li key={t.id}>
                      <a className="people__thread" href={`#/jobs?q=${encodeURIComponent(t.title.split(" - ")[0] ?? t.title)}`}>{t.title}</a>
                      {t.status && <Badge size="sm" tone={STATUS_TONE[t.status as Status] ?? "neutral"}>{t.status}</Badge>}
                      {t.role && <span className="muted"> · {t.role}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="microlabel">Log</div>
              <Markdown text={p.log || "_Nothing logged yet._"} />
            </div>
            <TextArea label="Log a contact" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="A call, a reply, a note to self. Dated today, moves last contact forward. Nothing is sent." />
            <div className="form__actions">
              <Button tone="primary" size="sm" onClick={log} disabled={busy || !text.trim()}>Log it</Button>
            </div>
          </div>
        )}
      </Sheet.Content>
    </Sheet>
  );
}

/** The People tab of a job sheet: who is on this thread, and a way to add someone. */
export function JobPeople({ job }: { job: Job }) {
  const [rows, setRows] = useState<JobPerson[] | null>(null);
  const [all, setAll] = useState<Person[]>([]);
  const [pick, setPick] = useState("");
  const [role, setRole] = useState<PersonRole>("recruiter");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => api.jobPeople(job.id).then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); api.people().then(setAll).catch(() => {}); }, [job.id]);
  const onThread = new Set((rows ?? []).map((r) => r.id));
  const others = all.filter((p) => !onThread.has(p.id));
  const attach = async () => {
    if (!pick) return;
    setBusy(true);
    try { await api.attachPerson(pick, job.id, role, context.trim()); setPick(""); setContext(""); load(); toast({ title: "Added to the note", description: `Under ## People on ${job.company} - ${job.title}.`, tone: "success" }); }
    catch (e) { toast({ title: "Not saved", description: (e as Error).message, tone: "danger" }); }
    setBusy(false);
  };
  return (
    <div className="detail">
      {rows === null ? <Skeleton lines={3} /> : rows.length === 0 ? (
        <p className="muted">No one on this thread yet. Confirming an email a person wrote adds them; or add someone below.</p>
      ) : (
        <ul className="people__list">
          {rows.map((r, i) => (
            <li key={`${r.id || r.name}-${i}`} className="people__row">
              <div>
                <span>{r.name}</span>
                {r.role && <Badge size="sm" tone={ROLE_TONE[roleOf(r.role)]} variant="soft">{ROLE_LABEL[roleOf(r.role)]}</Badge>}
                {r.context && <div className="reasons__detail">{r.context}</div>}
              </div>
              <div className="pager__buttons">
                {r.email && <a className="num muted" href={`mailto:${r.email}`}>{r.email}</a>}
                {r.id && <a className="muted" href={`#/people`} title={`People/${r.id}.md`}>People ↗</a>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="people__add">
        <div className="form__row">
          <Select size="sm" label="Someone already in People" value={pick || "__none__"} onValueChange={(v) => setPick(v === "__none__" ? "" : v)}>
            <Select.Item value="__none__">Pick a person</Select.Item>
            {others.map((p) => (
              <Select.Item key={p.id} value={p.id}>{p.name}{p.company ? ` · ${p.company}` : ""}</Select.Item>
            ))}
          </Select>
          <Select size="sm" label="On this thread as" value={role} onValueChange={(v) => setRole(v as PersonRole)}>
            {PERSON_ROLES.map((r) => (
              <Select.Item key={r} value={r}>{ROLE_LABEL[r]}</Select.Item>
            ))}
          </Select>
        </div>
        <TextField size="sm" label="Context" placeholder="A few words: reached out on LinkedIn, ran the screen, knows the team." value={context} onChange={(e) => setContext(e.target.value)} />
        <div className="form__actions">
          <Button size="sm" tone="primary" variant="soft" disabled={!pick || busy} onClick={attach}>Add to this thread</Button>
          <AddPerson job={job} onAdded={() => { load(); api.people().then(setAll).catch(() => {}); }} />
        </div>
      </div>
    </div>
  );
}
