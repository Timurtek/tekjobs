import { Badge, Button, Card, Icon, Skeleton, Tabs, TextArea, toast } from "@/components/ui";
import { useEffect, useState } from "react";
import { api, type ProfileNote } from "../api";

// The notes applications are written from, edited in place. Each tab is one note in Profile/; the resume is
// shown but not edited here, because it is replaced by `tekjobs resume sync` from the resume file.
function NoteEditor({ note, onSaved }: { note: ProfileNote; onSaved: () => void }) {
  const [text, setText] = useState(note.markdown);
  const [busy, setBusy] = useState(false);
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
            <Button asChild variant="soft" size="sm" trailingIcon={<Icon.ExternalLink />}>
              <a href={`obsidian://open?path=${encodeURIComponent(note.path)}`}>Open in Obsidian</a>
            </Button>
          </div>
        </div>
        {!note.exists && <Badge tone="warning" size="sm">This note does not exist yet; saving creates it.</Badge>}
        <TextArea label={`${note.title} (Markdown)`} font="mono" rows={28} resize="vertical" value={text} onChange={(e) => setText(e.target.value)} disabled={!note.editable} description={note.editable ? undefined : "Read-only here. Edit the resume file and run tekjobs resume sync."} />
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

export function Profile() {
  const [notes, setNotes] = useState<ProfileNote[] | null>(null);
  const load = () => api.profileNotes().then((p) => setNotes(p.notes)).catch((e: Error) => toast({ title: "Could not load the profile", description: e.message, tone: "danger" }));
  useEffect(() => { load(); }, []);
  if (!notes) return <Skeleton variant="rect" height="24rem" />;
  return (
    <>
      <div className="page__head">
        <div>
          <p>Who you are, how the story is told, and how you write. Cover letters, tailored resumes and application packets read these notes; the scan reads the Criteria page. Saving keeps yesterday's copy beside the note.</p>
        </div>
      </div>
      <Tabs defaultValue={notes[0]?.key ?? "profile"} variant="line" size="sm">
        <Tabs.List aria-label="Profile notes">
          {notes.map((n) => (
            <Tabs.Trigger key={n.key} value={n.key}>{n.title}</Tabs.Trigger>
          ))}
        </Tabs.List>
        {notes.map((n) => (
          <Tabs.Content key={n.key} value={n.key}>
            <NoteEditor note={n} onSaved={load} />
          </Tabs.Content>
        ))}
      </Tabs>
    </>
  );
}
