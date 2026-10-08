import { Badge, Button, Card, CodeBlock, Icon, Skeleton, TextField, toast } from "@/components/ui";
import { useEffect, useState } from "react";
import { api, type Learned, type Onboarding as OnboardingState } from "../api";
import type { Page } from "../components/Shell";

const INTERVIEW_PROMPT = `Use the tekjobs MCP server. Call onboarding_status, then onboarding_materials, and follow its script: interview me, write my profile, positioning and voice notes with save_profile, set the criteria with set_criteria, run a dry scan, and show me the top matches.`;

export function Onboarding({ onDone, onNavigate }: { onDone: () => void; onNavigate?: (page: Page) => void }) {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [learned, setLearned] = useState<Learned | null>(null);
  const [resumePath, setResumePath] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.onboarding().then((o) => { setState(o); if (o.steps.some((s) => s.id === "profile" && s.done)) api.learned().then(setLearned).catch(() => setLearned(null)); }).catch((e: Error) => toast({ title: "Server not answering", description: e.message, tone: "danger" }));
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
  const writingDone = state.writing.filter((s) => s.done).length;

  return (
    <>
      <div className="page__head">
        <div>
          <p>Five steps from an empty folder to a daily scan that knows who you are, then three notes the application drafts read. Your profile lives at <code>{state.dir}</code>. The scan and the notes stay on this machine; the interview and the drafting send what you choose to the AI client you connect.</p>
        </div>
        <Badge tone={state.complete ? "success" : "primary"} size="sm">{state.complete ? "Search ready" : `Search: ${done} of ${state.steps.length}`}</Badge>
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
                    <p className="muted">The interview runs in your own AI client, not here. Connect the server once (<code className="mono">claude mcp add tekjobs -- tekjobs mcp</code>; from a clone, opening Claude Code in <code className="mono">app/</code> does it) and paste:</p>
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

      {learned && learned.ready && (
        <>
          <div className="page__head">
            <div>
              <h2>What TekJobs learned</h2>
              <p className="muted">From your resume and the interview, in your terms. The scan runs on exactly this; if a line is wrong, change it on the Profile or Criteria page, or ask your AI client to.</p>
            </div>
            <div className="hero__actions">
              {onNavigate && <Button variant="ghost" size="sm" onClick={() => onNavigate("profile")}>Profile</Button>}
              {onNavigate && <Button variant="ghost" size="sm" onClick={() => onNavigate("criteria")}>Criteria</Button>}
            </div>
          </div>
          <Card padding="md">
            <div className="learned">
              <div className="learned__item">
                <span className="learned__label">Roles</span>
                <ul className="learned__list">
                  {learned.roles.map((r) => (
                    <li key={`${r.tier}-${r.title}`}>
                      <Badge size="sm" tone={r.tier === "A" ? "primary" : "neutral"} variant="soft">{r.tier}</Badge> {r.title}
                      {r.term ? <small className="muted"> · found by "{r.term}"</small> : <small className="learned__warn"> · no title term finds this</small>}
                    </li>
                  ))}
                  {learned.roles.length === 0 && <li className="muted">No target roles in the profile yet.</li>}
                </ul>
                <p className="muted learned__fine">Title terms, strongest first: {learned.titleTerms.map((t) => t.term).join(", ") || "none"}.</p>
              </div>
              <div className="learned__item">
                <span className="learned__label">Where</span>
                <p>{learned.where.profile || "Not stated in the profile."}</p>
                <p className="muted learned__fine">The scan: {learned.where.requireRemote ? "remote only; anything else drops out" : "remote scores higher; on-site and hybrid stay in"}{learned.where.metro.length ? `, with a bonus for ${learned.where.metro.join(", ")}` : ""}.</p>
              </div>
              <div className="learned__item">
                <span className="learned__label">Pay</span>
                <p>{learned.pay.floor ? <>Floor <span className="num">${Math.round(learned.pay.floor / 1000)}k</span>{learned.pay.stretch ? <>, would still look down to <span className="num">${Math.round(learned.pay.stretch / 1000)}k</span></> : null}.</> : "No floor set; pay does not move the score."}</p>
                {learned.pay.profile && <p className="muted learned__fine">Profile says: {learned.pay.profile}</p>}
              </div>
              <div className="learned__item">
                <span className="learned__label">Never</span>
                <p>{learned.exclusions.companies.length ? <>Companies matching <span className="mono">{learned.exclusions.companies.join(", ")}</span>. </> : null}{learned.exclusions.titles.length} excluded title words{learned.exclusions.titles.length ? `, such as ${learned.exclusions.titles.slice(0, 6).join(", ")}` : ""}.</p>
                {learned.exclusions.industries && <p className="muted learned__fine">Profile says: {learned.exclusions.industries}</p>}
              </div>
              <div className="learned__item">
                <span className="learned__label">What letters will lean on</span>
                <ul className="learned__list">
                  {learned.proofPoints.map((p) => <li key={p}>{p}</li>)}
                  {learned.proofPoints.length === 0 && <li className="muted">No proof points yet; letters fall back to the resume.</li>}
                </ul>
                {learned.keywords.length > 0 && <p className="muted learned__fine">Keywords the description score reads: {learned.keywords.join(", ")}.</p>}
              </div>
              <div className="learned__item">
                <span className="learned__label">What remains</span>
                {learned.remaining.length === 0
                  ? <p>Nothing. Search ready and writing ready.</p>
                  : <ul className="learned__list">{learned.remaining.map((r) => <li key={r}>{r}</li>)}</ul>}
              </div>
            </div>
          </Card>
        </>
      )}

      <div className="page__head">
        <div>
          <h2>Application writing</h2>
          <p className="muted">What a tailored resume or a letter is allowed to say comes from these three notes. The interview writes the last two; the import creates the first. Until they exist, drafts fall back to the imported resume text and the Profile page says what is missing.</p>
        </div>
        <Badge tone={state.writingReady ? "success" : "neutral"} size="sm">{state.writingReady ? "Writing ready" : `Writing: ${writingDone} of ${state.writing.length}`}</Badge>
      </div>
      <div className="steps">
        {state.writing.map((s) => (
          <Card key={s.id} padding="md" variant={s.done ? "sunken" : "outlined"}>
            <div className="step">
              <div className="step__mark">{s.done ? <Icon.Success /> : <span className="step__n">·</span>}</div>
              <div className="step__body">
                <span className="step__label">{s.label}</span>
                {!s.done && <p className="muted">{s.how}</p>}
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
