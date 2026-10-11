import { Badge, Button, EmptyState, Icon, Loader, Select, Skeleton, TextArea, TextField, toast } from "@/components/ui";
import { useEffect, useRef, useState } from "react";
import { api, type CoverLetterOptions, type CoverLetterState, type Job } from "../api";

/**
 * A cover letter for one posting, written from the person's own resume.
 *
 * The button runs a local LLM CLI the person is signed in to, so no key and nothing metered. The letter is
 * saved into the job note and checked against the resume: a figure the resume does not make is called out,
 * because a cover letter is where an eager model invents one. Nothing here sends anything.
 *
 * Reading comes first: a saved letter is shown as text, with Copy and Edit beside it, and the options for
 * writing another stay folded until asked for. On a phone a form field is not a place to read a letter.
 */
export function CoverLetter({ job }: { job: Job }) {
  const [state, setState] = useState<CoverLetterState | null>(null);
  const [text, setText] = useState("");
  const [opts, setOpts] = useState<CoverLetterOptions>({ emphasis: "auto", length: "standard", extra: "" });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const wasRunning = useRef(false);

  const take = (s: CoverLetterState, adoptText: boolean) => {
    setState(s);
    if (adoptText) setText(s.saved?.text ?? "");
  };
  useEffect(() => {
    setState(null);
    setEditing(false);
    setRewriting(false);
    api.coverLetter(job.id).then((s) => take(s, true)).catch((e: Error) => toast({ title: "Could not read the letter", description: e.message, tone: "danger" }));
  }, [job.id]);

  // While the CLI is writing, ask every few seconds; adopt the text once, when the run ends.
  useEffect(() => {
    if (!state?.running) {
      if (wasRunning.current && state) { wasRunning.current = false; take(state, !state.error); if (!state.error) { setRewriting(false); toast({ title: "Cover letter drafted", description: "Saved into the note. Read it before you use it.", tone: "success" }); } }
      return;
    }
    wasRunning.current = true;
    const t = setInterval(() => api.coverLetter(job.id).then((s) => setState(s)).catch(() => {}), 2500);
    return () => clearInterval(t);
  }, [state?.running, job.id]);

  const write = async () => {
    if (state?.saved && !window.confirm("Write a new letter? It replaces the one saved in this note.")) return;
    try { take(await api.writeCoverLetter(job.id, opts), false); }
    catch (e) { toast({ title: "Could not start", description: (e as Error).message, tone: "danger" }); }
  };
  const save = async () => {
    setSaving(true);
    try { take(await api.saveCoverLetter(job.id, text), true); setEditing(false); toast({ title: "Letter saved", description: "Written into the note and checked against your resume.", tone: "success" }); }
    catch (e) { toast({ title: "Not saved", description: (e as Error).message, tone: "danger" }); }
    setSaving(false);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast({ title: "Copied", tone: "success" }); }
    catch { toast({ title: "Could not copy", description: "Select the text and copy it by hand.", tone: "danger" }); }
  };

  if (!state) return <div className="detail"><Skeleton lines={6} /></div>;
  const saved = state.saved;
  const dirty = !!saved && text !== saved.text;
  const showOptions = !saved || rewriting;

  return (
    <div className="detail">
      {state.running && <Loader showLabel label={`${state.runner} is writing from your resume and this posting`} size="sm" />}

      {state.error && !state.running && (
        <EmptyState
          tone="danger"
          size="sm"
          icon={<Icon.Warning />}
          title={state.errorKind === "auth" ? `${state.runner} is signed out` : state.errorKind === "missing" ? `${state.runner} is not installed` : state.errorKind === "outdated" ? `${state.runner} is out of date` : "The letter was not written"}
          description={`${state.error} You can also ask any agent connected to the TekJobs MCP server to write it: "write the cover letter for ${job.company}".`}
        />
      )}

      {saved && !editing && (
        <>
          <div className="draft__doc" aria-label="Cover letter">{text}</div>
          <div className="form__actions form__actions--start">
            <Button tone="primary" size="md" onClick={copy} leadingIcon={<Icon.Copy />}>Copy</Button>
            <Button variant="soft" size="md" onClick={() => setEditing(true)} leadingIcon={<Icon.Edit />}>Edit</Button>
          </div>
        </>
      )}

      {saved && editing && (
        <>
          <TextArea label="Cover letter" rows={Math.max(10, text.split("\n").length + 4)} resize="vertical" value={text} onChange={(e) => setText(e.target.value)} description="Edit freely. Saving checks it against your resume again." />
          <div className="form__actions form__actions--start">
            <Button tone="primary" size="md" onClick={save} loading={saving} disabled={!dirty}>Save</Button>
            <Button variant="soft" size="md" onClick={() => { setText(saved.text); setEditing(false); }}>Cancel</Button>
          </div>
        </>
      )}

      {saved && (
        <>
          <div className="letter__meta">
            <Badge tone="neutral" size="sm">{saved.words} words</Badge>
            {saved.warnings.length === 0 ? <Badge tone="success" size="sm">Nothing flagged</Badge> : <Badge tone="warning" size="sm">{saved.warnings.length} to check</Badge>}
            {dirty && <Badge tone="primary" variant="outline" size="sm">Unsaved edits</Badge>}
          </div>
          {saved.warnings.length > 0 && (
            <ul className="letter__warnings">
              {saved.warnings.map((w) => (
                <li key={w.text}>
                  <Badge tone={w.kind === "claim" || w.kind === "placeholder" ? "danger" : "warning"} size="sm">{w.kind}</Badge>
                  <span>{w.text}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {saved && !rewriting && !state.running && (
        <div className="form__actions form__actions--start">
          <Button variant="ghost" size="md" onClick={() => setRewriting(true)} leadingIcon={<Icon.Sparkles />}>Write a new one</Button>
        </div>
      )}

      {showOptions && (
        <>
          <div className="letter__options">
            <Select size="md" label="Emphasis" value={opts.emphasis} onValueChange={(v) => setOpts({ ...opts, emphasis: v as CoverLetterOptions["emphasis"] })} disabled={state.running}>
              <Select.Item value="auto">Let the posting decide</Select.Item>
              <Select.Item value="design-systems">Design systems first</Select.Item>
              <Select.Item value="ai-product">AI product surfaces first</Select.Item>
            </Select>
            <Select size="md" label="Length" value={opts.length} onValueChange={(v) => setOpts({ ...opts, length: v as CoverLetterOptions["length"] })} disabled={state.running}>
              <Select.Item value="short">Short, about 150 words</Select.Item>
              <Select.Item value="standard">Standard, about 220 words</Select.Item>
            </Select>
          </div>
          <TextField size="md" label="Anything it should include" description="Optional. A person you spoke to, a product of theirs you use, a point to make." value={opts.extra} onChange={(e) => setOpts({ ...opts, extra: e.target.value })} disabled={state.running} />
          <div className="form__actions form__actions--start">
            <Button tone="primary" size="md" onClick={write} disabled={state.running} leadingIcon={state.running ? <Loader size="sm" /> : <Icon.Sparkles />}>
              {state.running ? "Writing" : saved ? "Write the new letter" : "Write cover letter"}
            </Button>
            {saved && !state.running && <Button variant="soft" size="md" onClick={() => setRewriting(false)}>Cancel</Button>}
          </div>
        </>
      )}

      {!saved && !state.running && !state.error && (
        <EmptyState
          size="sm"
          icon={<Icon.File />}
          title="No letter yet"
          description={`It is written from your resume and ${job.company}'s posting, and only your resume supplies the facts.`}
        />
      )}

      <p className="muted">The letter is saved under "Cover letter" in the job note. Nothing is sent from here; you paste it where the application asks for it.</p>
    </div>
  );
}
