import { Badge, Button, Card, Skeleton, TextField, toast } from "@/components/ui";
import { useEffect, useState } from "react";
import { api, type Settings as SettingsData } from "../api";

/**
 * Settings: the handful of things that live outside the profile folder because they say where it is.
 * ~/.tekjobs/config.json, edited here. Everything else is a note in the folder and has its own page.
 */
export function Settings() {
  const [s, setS] = useState<SettingsData | null>(null);
  const [form, setForm] = useState({ profile: "", resumeDir: "", llmCommand: "", llmArgs: "", contact: "" });
  const [busy, setBusy] = useState(false);
  const [restart, setRestart] = useState(false);
  const load = () => api.settings().then((d) => { setS(d); setForm({ profile: d.profile.configured || d.profile.active, resumeDir: d.resumeDir.configured || d.resumeDir.path, llmCommand: d.llm.command, llmArgs: d.llm.args, contact: d.contact }); }).catch((e: Error) => toast({ title: "Could not read the settings", description: e.message, tone: "danger" }));
  useEffect(() => { load(); }, []);
  if (!s) return <Skeleton variant="rect" height="20rem" />;

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.saveSettings(form);
      setS(r); setRestart(r.restart || restart);
      toast({ title: "Settings saved", description: r.configFile, tone: "success" });
    } catch (e) { toast({ title: "Not saved", description: (e as Error).message, tone: "danger" }); }
    setBusy(false);
  };

  return (
    <>
      <div className="page__head">
        <div>
          <p>Where things live. These are the only settings kept outside the profile folder, in <code className="mono">{s.configFile}</code>; everything about the search itself is a note in the folder.</p>
        </div>
      </div>
      <div className="detail">
        {restart && <Badge tone="warning" size="md">The profile folder changed. Restart the server (<code className="mono">npm run server</code>, or the scheduled task's next run) to switch; until then the app keeps reading {s.profile.active}.</Badge>}
        <Card padding="md">
          <div className="form">
            <div>
              <h2 className="settings__h">Profile folder</h2>
              <p className="muted">Your job search: profile, resume, criteria, watchlist, one note per job, logs. Plain markdown; point Obsidian at it. Reading now: <code className="mono">{s.profile.active}</code>{s.profile.fromEnv ? " (set by TEKJOBS_PROFILE in the environment, which wins over this file)" : ""}.</p>
            </div>
            <TextField label="Folder" value={form.profile} onChange={(e) => setForm({ ...form, profile: e.target.value })} description="Must exist. To start a new profile somewhere, run tekjobs init <dir> instead; it writes the starter notes. Takes effect on the next server start." />
          </div>
        </Card>
        <Card padding="md">
          <div className="form">
            <div>
              <h2 className="settings__h">Resume variants folder</h2>
              <p className="muted">PDF, DOCX, Markdown or text files, one per variant. The Profile page lists them and makes any one the resume of record; the packet's Resume variant field offers their names. {s.resumeDir.exists ? "" : "This folder does not exist yet."}</p>
            </div>
            <TextField label="Folder" value={form.resumeDir} onChange={(e) => setForm({ ...form, resumeDir: e.target.value })} description={`Default: Templates/Resume inside the profile folder. Resume of record now: ${s.resumeSource || "not set"}.`} />
          </div>
        </Card>
        <Card padding="md">
          <div className="form">
            <div>
              <h2 className="settings__h">Writing CLI</h2>
              <p className="muted">The local coding CLI that writes letters and tailored resumes and reads the mailbox. It must be signed in on this machine. Claude Code by default; another CLI works if it takes the prompt on stdin and prints the answer.</p>
            </div>
            <div className="form__row">
              <TextField label="Command" value={form.llmCommand} onChange={(e) => setForm({ ...form, llmCommand: e.target.value })} />
              <TextField label="Arguments" value={form.llmArgs} onChange={(e) => setForm({ ...form, llmArgs: e.target.value })} font="mono" />
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="form">
            <div>
              <h2 className="settings__h">Contact for scans</h2>
              <p className="muted">Optional. Added to the user agent on every request the scan makes, so a site can reach the person running it.</p>
            </div>
            <TextField label="Email" type="email" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          </div>
        </Card>
        <div className="form__actions">
          <Button tone="primary" size="sm" loading={busy} onClick={save}>Save settings</Button>
        </div>
      </div>
    </>
  );
}
