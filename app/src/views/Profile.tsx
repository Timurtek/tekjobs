import { Badge, Button, Card, EmptyState, Icon, Markdown, Skeleton, Table, Tabs, TextArea, toast } from "@/components/ui";
import { useEffect, useState } from "react";
import { api, type ProfileNote, type ProfileSummary, type Resumes } from "../api";
import { ProfileSummaryView } from "../components/ProfileSummary";

/** The note without its frontmatter, for reading. */
const bodyOf = (md: string) => md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");

// The notes applications are written from, edited in place. Each tab is one note in Profile/; the resume is
// shown but not edited here, because it is replaced by `tekjobs resume sync` from the resume file.
function NoteEditor({ note, onSaved }: { note: ProfileNote; onSaved: () => void }) {
  const [text, setText] = useState(note.markdown);
  const [busy, setBusy] = useState(false);
  // Read-only notes open on the rendered page; editable ones open on the source, a tab away from the page.
  const [mode, setMode] = useState<"edit" | "preview">(note.editable ? "edit" : "preview");
  useEffect(() => setText(note.markdown), [note.markdown]);
  const dirty = text !== note.markdown;
  const save = async () => {
    setBusy(true);
    try { const r = await api.saveProfileNote(note.key, text); toast({ title: `${note.title} saved`, description: r.saved, tone: "success" }); onSaved(); }
    catch (e) { toast({ title: `${note.title} not saved`, description: (e as Error).message, tone: "danger" }); }
    setBusy(false);
  };
  return (
    <Card padding="md">
      <div className="form">
        <div className="panel__head">
          <div>
            <p>{note.hint}</p>
            <p className="muted"><code>{note.path}</code></p>
          </div>
          <div className="pager__buttons">
            <Tabs value={mode} onValueChange={(v) => setMode(v as "edit" | "preview")} variant="pill" size="sm">
              <Tabs.List aria-label="Edit or preview">
                <Tabs.Trigger value="edit">{note.editable ? "Edit" : "Source"}</Tabs.Trigger>
                <Tabs.Trigger value="preview">Preview</Tabs.Trigger>
              </Tabs.List>
            </Tabs>
            <Button asChild variant="soft" size="sm" trailingIcon={<Icon.ExternalLink />}>
              <a href={`obsidian://open?path=${encodeURIComponent(note.path)}`}>Open in Obsidian</a>
            </Button>
          </div>
        </div>
        {!note.exists && <Badge tone="warning" size="sm">This note does not exist yet; saving creates it.</Badge>}
        {mode === "preview" ? (
          <div className="preview-doc">
            <Markdown text={bodyOf(text) || "_Nothing here yet._"} />
          </div>
        ) : (
          <TextArea label={`${note.title} (Markdown)`} font="mono" rows={28} resize="vertical" value={text} onChange={(e) => setText(e.target.value)} disabled={!note.editable} description={note.editable ? undefined : "Read-only here. Pick a variant below, or edit the resume file and run tekjobs resume sync."} />
        )}
        {note.editable && (
          <div className="form__actions">
            <Button variant="ghost" size="sm" disabled={!dirty || busy} onClick={() => setText(note.markdown)}>Discard</Button>
            <Button tone="primary" size="sm" disabled={!dirty || busy} loading={busy} onClick={save}>Save to the vault</Button>
          </div>
        )}
      </div>
    </Card>
  );
}

/** The folder of resume files: each one a click away from being the resume of record. */
function ResumeVariants({ onChanged }: { onChanged: () => void }) {
  const [r, setR] = useState<Resumes | null>(null);
  const [busy, setBusy] = useState("");
  const load = () => api.resumes().then(setR).catch((e: Error) => toast({ title: "Could not read the resume folder", description: e.message, tone: "danger" }));
  useEffect(() => { load(); }, []);
  const use = async (name: string) => {
    setBusy(name);
    try {
      const res = await api.useResume(name);
      toast({ title: `${name} is the resume of record`, description: `${res.chars} characters into Profile/Resume.md; ${res.added.length} lines new, ${res.removed.length} gone${res.stale.length ? `, ${res.stale.length} drafts quote a removed claim` : ""}.`, tone: "success" });
      load(); onChanged();
    } catch (e) { toast({ title: "Not switched", description: (e as Error).message, tone: "danger" }); }
    setBusy("");
  };
  const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} KB`;
  return (
    <Card padding={r && r.files.length ? "none" : "md"}>
      {!r ? <Skeleton lines={3} /> : r.files.length === 0 ? (
        <EmptyState size="sm" title="No resume variants yet" description={`Drop PDF, DOCX, Markdown or text files into ${r.dir}${r.exists ? "" : " (the folder does not exist yet)"} and they appear here. The folder is set in Settings.`} />
      ) : (
        <>
          <Table aria-label="Resume variants" density="md">
            <Table.Head>
              <Table.Row>
                <Table.HeadCell>File</Table.HeadCell>
                <Table.HeadCell>Changed</Table.HeadCell>
                <Table.HeadCell>Size</Table.HeadCell>
                <Table.HeadCell>Use</Table.HeadCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {r.files.map((f) => (
                <Table.Row key={f.name}>
                  <Table.Cell>
                    <span className="chips">
                      {f.name}
                      {f.current && <Badge size="sm" tone="primary" variant="soft">resume of record</Badge>}
                    </span>
                  </Table.Cell>
                  <Table.Cell><span className="num muted">{f.modified}</span></Table.Cell>
                  <Table.Cell><span className="num muted">{kb(f.size)}</span></Table.Cell>
                  <Table.Cell>
                    <div className="pager__buttons">
                      <Button size="sm" variant="ghost" tone="neutral" onClick={() => api.openResume(f.name).catch((e: Error) => toast({ title: "Could not open", description: e.message, tone: "danger" }))}>Open</Button>
                      {!f.current && <Button size="sm" variant="soft" tone="primary" disabled={!!busy} loading={busy === f.name} onClick={() => use(f.name)}>Make it the resume of record</Button>}
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
          <p className="muted variants__foot">From <code className="mono">{r.dir}</code>. Making one the record reads it into Profile/Resume.md, which every tailored resume and letter starts from; the packet's Resume variant field offers these names.</p>
        </>
      )}
    </Card>
  );
}

export function Profile() {
  const [notes, setNotes] = useState<ProfileNote[] | null>(null);
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const load = () => { api.profileSummary().then(setSummary).catch(() => {}); return api.profileNotes().then((p) => setNotes(p.notes)).catch((e: Error) => toast({ title: "Could not load the profile", description: e.message, tone: "danger" })); };
  useEffect(() => { load(); }, []);
  if (!notes) return <Skeleton variant="rect" height="24rem" />;
  return (
    <>
      <div className="page__head">
        <div>
          <p>Who you are, how the story is told, and how you write. Cover letters, tailored resumes and application packets read these notes; the scan reads the Criteria page. Saving keeps yesterday's copy beside the note.</p>
        </div>
      </div>
      <Tabs defaultValue="summary" variant="line" size="sm">
        <Tabs.List aria-label="Profile notes">
          <Tabs.Trigger value="summary">Summary</Tabs.Trigger>
          {notes.map((n) => (
            <Tabs.Trigger key={n.key} value={n.key}>{n.title}</Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="summary">
          {summary ? <ProfileSummaryView s={summary} /> : <Skeleton variant="rect" height="12rem" />}
        </Tabs.Content>
        {notes.map((n) => (
          <Tabs.Content key={n.key} value={n.key}>
            <div className="detail">
              {n.key === "resume" && <ResumeVariants onChanged={load} />}
              <NoteEditor note={n} onSaved={load} />
            </div>
          </Tabs.Content>
        ))}
      </Tabs>
    </>
  );
}
