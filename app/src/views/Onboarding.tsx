import { Badge, Button, Card, CodeBlock, Icon, Skeleton, TextField, toast } from "@/components/ui";
import { useEffect, useState } from "react";
import { api, type Onboarding as OnboardingState } from "../api";

const INTERVIEW_PROMPT = `Use the tekjobs MCP server. Call onboarding_status, then onboarding_materials, and follow its script: interview me, write my profile with save_profile, set the criteria with set_criteria, run a dry scan, and show me the top matches.`;

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [resumePath, setResumePath] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.onboarding().then(setState).catch((e: Error) => toast({ title: "Server not answering", description: e.message, tone: "danger" }));
  useEffect(() => { load(); }, []);

  const init = async () => {
    setBusy(true);
    try { const r = await api.initProfile(); toast({ title: "Profile folder ready", description: r.made.length ? `Created ${r.made.join(", ")}` : "It already existed; nothing was overwritten.", tone: "success" }); await load(); }
    catch (e) { toast({ title: "Could not create the folder", description: (e as Error).message, tone: "danger" }); }
    setBusy(false);
  };
  const importResume = async () => {
    if (!resumePath.trim()) return;
    setBusy(true);
    try { const r = await api.importResume(resumePath.trim()); toast({ title: "Resume imported", description: `${r.chars.toLocaleString()} characters of text extracted.`, tone: "success" }); setResumePath(""); await load(); }
    catch (e) { toast({ title: "Import failed", description: (e as Error).message, tone: "danger" }); }
    setBusy(false);
  };

  if (!state) return <Skeleton variant="rect" height="20rem" />;
  const done = state.steps.filter((s) => s.done).length;

  return (
    <>
      <div className="page__head">
        <div>
          <p>Five steps from an empty folder to a daily scan that knows who you are. Your profile lives at <code>{state.dir}</code>. Nothing leaves this machine.</p>
        </div>
        <Badge tone={state.complete ? "success" : "primary"} size="sm">{done} of {state.steps.length} done</Badge>
      </div>

      <div className="steps">
        {state.steps.map((s, i) => (
          <Card key={s.id} padding="md" variant={s.done ? "sunken" : "outlined"}>
            <div className="step">
              <div className="step__mark">{s.done ? <Icon.Success /> : <span className="step__n">{i + 1}</span>}</div>
              <div className="step__body">
                <span className="step__label">{s.label}</span>
                {!s.done && <p className="muted">{s.how}</p>}

                {!s.done && s.id === "folder" && (
                  <div className="form__actions form__actions--start">
                    <Button tone="primary" size="sm" loading={busy} onClick={init}>Create the profile folder</Button>
                  </div>
                )}
                {!s.done && s.id === "resume" && (
                  <div className="step__row">
                    <TextField size="sm" label="Path to your resume" placeholder="C:\Users\you\Downloads\resume.pdf" description="PDF, DOCX, Markdown or text. The file is copied into Profile/ and its text extracted." value={resumePath} onChange={(e) => setResumePath(e.target.value)} />
                    <Button tone="primary" size="sm" loading={busy} disabled={!resumePath.trim()} onClick={importResume}>Import</Button>
                  </div>
                )}
                {!s.done && s.id === "profile" && (
                  <div className="detail">
                    <p className="muted">The interview runs in your own LLM, not here. Open Claude Code in the app folder (its .mcp.json connects it) and paste:</p>
                    <CodeBlock code={INTERVIEW_PROMPT} language="text" wrap />
                    <p className="muted">Codex, Cursor or Claude Desktop work the same way once the tekjobs MCP server is added; see Agent access.</p>
                  </div>
                )}
                {!s.done && s.id === "scan" && (
                  <div className="form__actions form__actions--start">
                    <Button tone="primary" size="sm" onClick={() => { api.startScan(false).then(() => toast({ title: "Scan started", description: "Watch it on the Runs screen.", tone: "success" })).catch((e: Error) => toast({ title: "Could not start", description: e.message, tone: "danger" })); }}>Run the first scan</Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {state.complete && (
        <div className="form__actions">
          <Button tone="primary" onClick={onDone} trailingIcon={<Icon.ArrowRight />}>Go to the overview</Button>
        </div>
      )}
    </>
  );
}
