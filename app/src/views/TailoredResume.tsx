import { Badge, Button, EmptyState, Icon, Loader, Markdown, Select, Skeleton, TextArea, TextField, toast } from "@/components/ui";
import { useEffect, useRef, useState } from "react";
import { api, type CoverLetterEmphasis, type Job, type TailoredResumeState } from "../api";

/**
 * The resume, tailored to this posting: same jobs, dates and numbers, different order, emphasis and summary.
 *
 * A resume is uploaded, so the check is stricter than the letter's: every bullet must trace to a line of the
 * resume of record, and no figure, date range or job header may be new. Warnings are shown, not enforced;
 * the person reads them and prints.
 *
 * Reading comes first, as with the letter: the saved resume is rendered, with Copy, Edit and the print view
 * beside it, and the options for tailoring again stay folded until asked for.
 */
export function TailoredResume({ job }: { job: Job }) {
  const [state, setState] = useState<TailoredResumeState | null>(null);
  const [text, setText] = useState("");
  const [emphasis, setEmphasis] = useState<CoverLetterEmphasis>("auto");
  const [extra, setExtra] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const wasRunning = useRef(false);

  const take = (s: TailoredResumeState, adoptText: boolean) => { setState(s); if (adoptText) setText(s.saved?.text ?? ""); };
  useEffect(() => {
    setState(null);
    setEditing(false);
    setRewriting(false);
    api.tailoredResume(job.id).then((s) => take(s, true)).catch((e: Error) => toast({ title: "Could not read the resume", description: e.message, tone: "danger" }));
  }, [job.id]);
  useEffect(() => {
    if (!state?.running) {
      if (wasRunning.current && state) { wasRunning.current = false; take(state, !state.error); if (!state.error) { setRewriting(false); toast({ title: "Resume tailored", description: "Saved into the note. Read the warnings, then print.", tone: "success" }); } }
      return;
    }
    wasRunning.current = true;
    const t = setInterval(() => api.tailoredResume(job.id).then((s) => setState(s)).catch(() => {}), 2500);
    return () => clearInterval(t);
  }, [state?.running, job.id]);

  const write = async () => {
    if (state?.saved && !window.confirm("Tailor again? It replaces the version saved in this note.")) return;
    try { take(await api.writeTailoredResume(job.id, { emphasis, extra }), false); }
    catch (e) { toast({ title: "Could not start", description: (e as Error).message, tone: "danger" }); }
  };
  const save = async () => {
    setSaving(true);
    try { take(await api.saveTailoredResume(job.id, text), true); setEditing(false); toast({ title: "Saved", description: "Checked against your resume of record again.", tone: "success" }); }
    catch (e) { toast({ title: "Not saved", description: (e as Error).message, tone: "danger" }); }
    setSaving(false);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast({ title: "Copied", description: "The Markdown, headings and all.", tone: "success" }); }
    catch { toast({ title: "Could not copy", description: "Open Edit, select the text and copy it by hand.", tone: "danger" }); }
  };

  if (!state) return <div className="detail"><Skeleton lines={6} /></div>;
  const saved = state.saved;
  const dirty = !!saved && text !== saved.text;
  const hard = saved ? saved.warnings.filter((w) => w.kind === "trace" || w.kind === "claim" || w.kind === "header" || w.kind === "date").length : 0;
  const showOptions = !saved || rewriting;

  return (
    <div className="detail">
      {state.running && <Loader showLabel label={`${state.runner} is reordering your resume for ${job.company}`} size="sm" />}

      {state.error && !state.running && (
        <EmptyState tone="danger" size="sm" icon={<Icon.Warning />} title={state.errorKind === "auth" ? `${state.runner} is signed out` : state.errorKind === "outdated" ? `${state.runner} is out of date` : "The resume was not written"} description={state.error} />
      )}

      {saved && !editing && (
        <>
          <div className="draft__doc draft__doc--markdown" aria-label="Tailored resume"><Markdown text={text} /></div>
          <div className="form__actions form__actions--start">
            <Button asChild tone="primary" size="md" trailingIcon={<Icon.ExternalLink />}>
              <a href={api.resumePrintUrl(job.id)} target="_blank" rel="noopener noreferrer">Print / save as PDF</a>
            </Button>
            <Button variant="soft" size="md" onClick={copy} leadingIcon={<Icon.Copy />}>Copy</Button>
            <Button variant="soft" size="md" onClick={() => setEditing(true)} leadingIcon={<Icon.Edit />}>Edit</Button>
          </div>
        </>
      )}

      {saved && editing && (
        <>
          <TextArea label="Tailored resume (Markdown)" rows={Math.max(12, text.split("\n").length + 4)} resize="vertical" font="mono" value={text} onChange={(e) => setText(e.target.value)} description="Keep the headings. Saving re-runs the trace check." />
          <div className="form__actions form__actions--start">
            <Button tone="primary" size="md" onClick={save} loading={saving} disabled={!dirty}>Save</Button>
            <Button variant="soft" size="md" onClick={() => { setText(saved.text); setEditing(false); }}>Cancel</Button>
          </div>
        </>
      )}

      {saved && (
        <>
          <div className="letter__meta">
            <Badge tone="neutral" size="sm">{saved.words} words · {saved.bullets} bullets</Badge>
            {hard === 0 ? <Badge tone="success" size="sm">Every line traces to your resume</Badge> : <Badge tone="danger" size="sm">{hard} line{hard === 1 ? "" : "s"} not on your resume</Badge>}
            {saved.warnings.length > hard && <Badge tone="warning" size="sm">{saved.warnings.length - hard} style</Badge>}
            {dirty && <Badge tone="primary" variant="outline" size="sm">Unsaved edits</Badge>}
          </div>
          {saved.warnings.length > 0 && (
            <ul className="letter__warnings">
              {saved.warnings.map((w) => (
                <li key={w.text}>
                  <Badge tone={w.kind === "style" || w.kind === "length" ? "warning" : "danger"} size="sm">{w.kind}</Badge>
                  <span>{w.text}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {saved && !rewriting && !state.running && (
        <div className="form__actions form__actions--start">
          <Button variant="ghost" size="md" onClick={() => setRewriting(true)} leadingIcon={<Icon.Sparkles />}>Tailor again</Button>
        </div>
      )}

      {showOptions && (
        <>
          <div className="letter__options">
            <Select size="md" label="Emphasis" value={emphasis} onValueChange={(v) => setEmphasis(v as CoverLetterEmphasis)} disabled={state.running}>
              <Select.Item value="auto">Let the posting decide</Select.Item>
              <Select.Item value="design-systems">Design systems first</Select.Item>
              <Select.Item value="ai-product">AI product surfaces first</Select.Item>
            </Select>
            <TextField size="md" label="Anything to bring forward" description="Optional. A project, a tool, a role to lead with." value={extra} onChange={(e) => setExtra(e.target.value)} disabled={state.running} />
          </div>
          <div className="form__actions form__actions--start">
            <Button tone="primary" size="md" onClick={write} disabled={state.running} leadingIcon={state.running ? <Loader size="sm" /> : <Icon.Sparkles />}>
              {state.running ? "Tailoring" : saved ? "Tailor it again" : "Tailor my resume to this posting"}
            </Button>
            {saved && !state.running && <Button variant="soft" size="md" onClick={() => setRewriting(false)}>Cancel</Button>}
          </div>
        </>
      )}

      {!saved && !state.running && !state.error && (
        <EmptyState size="sm" icon={<Icon.File />} title="Not tailored yet" description={`Same jobs, dates and numbers as your resume of record. The summary, order and emphasis change for ${job.company}. Nothing is added.`} />
      )}

      <p className="muted">Saved under "Tailored resume" in the job note; the packet's Resume variant field points at it. The PDF you upload comes from the print view.</p>
    </div>
  );
}
