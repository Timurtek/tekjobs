import { Badge, Button, EmptyState, Icon, Loader, Select, Skeleton, TextArea, TextField, toast } from "@/components/ui";
import { useEffect, useRef, useState } from "react";
import { api, type CoverLetterOptions, type CoverLetterState, type Job } from "../api";

/**
 * A cover letter for one posting, written from the person's own resume.
 *
 * The button runs a local LLM CLI the person is signed in to, so no key and nothing metered. The letter is
 * saved into the job note and checked against the resume: a figure the resume does not make is called out,
 * because a cover letter is where an eager model invents one. Nothing here sends anything.
 */
export function CoverLetter({ job }: { job: Job }) {
  const [state, setState] = useState<CoverLetterState | null>(null);
  const [text, setText] = useState("");
  const [opts, setOpts] = useState<CoverLetterOptions>({ emphasis: "auto", length: "standard", extra: "" });
  const [saving, setSaving] = useState(false);
  const wasRunning = useRef(false);

  const take = (s: CoverLetterState, adoptText: boolean) => {
    setState(s);
    if (adoptText) setText(s.saved?.text ?? "");
  };
  useEffect(() => {
    setState(null);
    api.coverLetter(job.id).then((s) => take(s, true)).catch((e: Error) => toast({ title: "Could not read the letter", description: e.message, tone: "danger" }));
  }, [job.id]);

  // While the CLI is writing, ask every few seconds; adopt the text once, when the run ends.
  useEffect(() => {
    if (!state?.running) {
      if (wasRunning.current && state) { wasRunning.current = false; take(state, !state.error); if (!state.error) toast({ title: "Cover letter drafted", description: "Saved into the note. Read it before you use it.", tone: "success" }); }
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
    try { take(await api.saveCoverLetter(job.id, text), true); toast({ title: "Letter saved", description: "Written into the note and checked against your resume.", tone: "success" }); }
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

  return (
    <div className="detail">
      <div className="letter__options">
        <Select size="sm" label="Emphasis" value={opts.emphasis} onValueChange={(v) => setOpts({ ...opts, emphasis: v as CoverLetterOptions["emphasis"] })} disabled={state.running}>
          <Select.Item value="auto">Let the posting decide</Select.Item>
          <Select.Item value="design-systems">Design systems first</Select.Item>
          <Select.Item value="ai-product">AI product surfaces first</Select.Item>
        </Select>
        <Select size="sm" label="Length" value={opts.length} onValueChange={(v) => setOpts({ ...opts, length: v as CoverLetterOptions["length"] })} disabled={state.running}>
          <Select.Item value="short">Short, about 150 words</Select.Item>
          <Select.Item value="standard">Standard, about 220 words</Select.Item>
        </Select>
      </div>
      <TextField size="sm" label="Anything it should include" description="Optional. A person you spoke to, a product of theirs you use, a point to make." value={opts.extra} onChange={(e) => setOpts({ ...opts, extra: e.target.value })} disabled={state.running} />

      <div className="form__actions form__actions--start">
        <Button tone="primary" size="sm" onClick={write} disabled={state.running} leadingIcon={state.running ? <Loader size="sm" /> : <Icon.Sparkles />}>
          {state.running ? "Writing" : saved ? "Write a new one" : "Write cover letter"}
        </Button>
        {saved && <Button variant="soft" size="sm" onClick={copy} leadingIcon={<Icon.Copy />}>Copy</Button>}
        {dirty && <Button variant="soft" tone="primary" size="sm" onClick={save} loading={saving}>Save edits</Button>}
      </div>

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

      {!saved && !state.running && !state.error && (
        <EmptyState
          size="sm"
          icon={<Icon.File />}
          title="No letter yet"
          description={`It is written from your resume and ${job.company}'s posting, and only your resume supplies the facts.`}
        />
      )}

      {saved && (
        <>
          <TextArea label="Cover letter" rows={16} resize="vertical" value={text} onChange={(e) => setText(e.target.value)} description="Edit freely. Saving checks it against your resume again." />
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

      <p className="muted">The letter is saved under "Cover letter" in the job note. Nothing is sent from here; you paste it where the application asks for it.</p>
    </div>
  );
}
