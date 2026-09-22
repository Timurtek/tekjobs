import { Badge, Button, Card, Dialog, Select, Skeleton, Switch, Tabs, TextArea, TextField, toast } from "@/components/ui";
import { useEffect, useMemo, useState } from "react";
import { api, money, type CriteriaPreset, type CriteriaPreview, type PreviewRow } from "../api";

/** A short list of notes with before → after scores, for the impact preview. */
function Movers({ title, rows, empty }: { title: string; rows: PreviewRow[]; empty: string }) {
  return (
    <div className="preview__block">
      <h3>{title} <span className="muted">({rows.length})</span></h3>
      {rows.length === 0 ? <p className="muted">{empty}</p> : (
        <ul className="preview__list">
          {rows.slice(0, 8).map((r) => (
            <li key={r.id}><span className="preview__score">{r.before} → {r.after}</span> {r.company} — {r.title}</li>
          ))}
          {rows.length > 8 && <li className="muted">and {rows.length - 8} more</li>}
        </ul>
      )}
    </div>
  );
}

// The criteria JSON is the source of truth; every field reads from it and writes back into it, so keys this
// form knows nothing about survive a save untouched. "Active" is Targets/Search Criteria.md, the set the daily
// scan uses. A preset is a second note under Targets/Criteria/ that a scan can run with on request.

type Doc = Record<string, unknown>;
const ACTIVE = "__active__";
const KNOWN_SOURCES = ["remoteok", "hn", "email", "adzuna", "usajobs", "themuse", "remotive", "himalayas", "jobicy", "workingnomads", "arbeitnow", "wwr", "wellfound", "builtin"];
const SOURCE_LABEL: Record<string, string> = { remoteok: "RemoteOK", hn: "HN Who is hiring", email: "Alert emails (Inbox/)", adzuna: "Adzuna (needs a key)", usajobs: "USAJOBS (needs a key)", themuse: "The Muse", remotive: "Remotive", himalayas: "Himalayas", jobicy: "Jobicy", workingnomads: "Working Nomads", arbeitnow: "Arbeitnow", wwr: "We Work Remotely", wellfound: "Wellfound", builtin: "Built In" };

const get = (doc: Doc, path: string[]): unknown => path.reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Doc)[k] : undefined), doc);
function set(doc: Doc, path: string[], value: unknown): Doc {
  const [head, ...rest] = path;
  if (!head) return doc;
  const next: Doc = { ...doc };
  if (!rest.length) { if (value === undefined) delete next[head]; else next[head] = value; return next; }
  const child = doc[head] && typeof doc[head] === "object" && !Array.isArray(doc[head]) ? (doc[head] as Doc) : {};
  next[head] = set(child, rest, value);
  return next;
}

/** A number field bound to a path in the doc. Empty clears the key. */
function Num({ doc, path, label, hint, onChange, step = 1 }: { doc: Doc; path: string[]; label: string; hint?: string; onChange: (d: Doc) => void; step?: number }) {
  const v = get(doc, path);
  return (
    <TextField
      size="sm"
      type="number"
      step={step}
      label={label}
      description={hint}
      value={typeof v === "number" ? String(v) : ""}
      onChange={(e) => onChange(set(doc, path, e.target.value === "" ? undefined : Number(e.target.value)))}
    />
  );
}

/** Weighted terms (`term: weight`, one per line) or plain terms (one per line), edited as text and committed on blur. */
function ListEditor({ label, hint, value, weighted, rows = 8, onCommit }: { label: string; hint?: string; value: unknown; weighted: boolean; rows?: number; onCommit: (v: Record<string, number> | string[]) => void }) {
  const toText = (v: unknown) => weighted
    ? Object.entries((v as Record<string, number>) || {}).map(([k, n]) => `${k}: ${n}`).join("\n")
    : ((v as string[]) || []).join("\n");
  const [text, setText] = useState(() => toText(value));
  const [error, setError] = useState("");
  useEffect(() => { setText(toText(value)); setError(""); }, [value]); // a preset load replaces the doc wholesale
  const commit = () => {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!weighted) { setError(""); onCommit(lines); return; }
    const out: Record<string, number> = {};
    for (const line of lines) {
      const m = line.match(/^(.*?)\s*:\s*(-?\d+(?:\.\d+)?)\s*$/);
      if (!m || !m[1]) { setError(`"${line}" is not "term: weight".`); return; }
      out[m[1].trim().toLowerCase()] = Number(m[2]);
    }
    setError("");
    onCommit(out);
  };
  return <TextArea label={label} description={hint} font="mono" rows={rows} resize="vertical" value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} error={error || undefined} />;
}

export function Criteria() {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [savedRaw, setSavedRaw] = useState("");
  const [editing, setEditing] = useState(ACTIVE);
  const [presets, setPresets] = useState<CriteriaPreset[]>([]);
  const [busy, setBusy] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [saveAs, setSaveAs] = useState<null | string>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [preview, setPreview] = useState<CriteriaPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const raw = useMemo(() => (doc ? JSON.stringify(doc, null, 2) : ""), [doc]);
  const dirty = doc !== null && raw !== savedRaw;
  const isPreset = editing !== ACTIVE;

  const loadPresets = () => api.criteriaPresets().then(setPresets).catch(() => setPresets([]));
  const load = async (which: string) => {
    try {
      const c = which === ACTIVE ? await api.criteria() : await api.criteriaPreset(which);
      if (!c.parsed) throw new Error("That note's JSON does not parse. Fix it in Obsidian first.");
      setDoc(c.parsed); setSavedRaw(JSON.stringify(c.parsed, null, 2)); setJsonText(JSON.stringify(c.parsed, null, 2)); setJsonError(""); setEditing(which);
    } catch (e) { toast({ title: "Could not load criteria", description: (e as Error).message, tone: "danger" }); }
  };
  useEffect(() => { load(ACTIVE); loadPresets(); }, []);
  useEffect(() => { setJsonText(raw); setJsonError(""); }, [raw]);

  const update = (d: Doc) => setDoc(d);
  const save = async () => {
    if (!doc) return;
    setBusy(true);
    try {
      if (isPreset) { const p = await api.saveCriteriaPreset(editing, raw); setSavedRaw(JSON.stringify(p.parsed, null, 2)); toast({ title: `Preset "${editing}" saved`, description: "Run a scan with it from here or from Runs; make it active to have the daily scan use it.", tone: "success" }); }
      else { const c = await api.saveCriteria(raw); setSavedRaw(JSON.stringify(c.parsed, null, 2)); toast({ title: "Criteria saved", description: "Targets/Search Criteria.md updated. The next scan uses it.", tone: "success" }); }
      loadPresets();
    } catch (e) { toast({ title: "Not saved", description: (e as Error).message, tone: "danger" }); }
    setBusy(false);
  };
  const saveAsPreset = async () => {
    if (!doc || !saveAs?.trim()) return;
    setBusy(true);
    try { const p = await api.saveCriteriaPreset(saveAs.trim(), raw); setSaveAs(null); await loadPresets(); setEditing(p.name); setSavedRaw(JSON.stringify(p.parsed, null, 2)); toast({ title: `Preset "${p.name}" created`, description: p.file, tone: "success" }); }
    catch (e) { toast({ title: "Not saved", description: (e as Error).message, tone: "danger" }); }
    setBusy(false);
  };
  const activate = async () => {
    setBusy(true);
    try { await api.activateCriteriaPreset(editing); await loadPresets(); toast({ title: `"${editing}" is now the active criteria`, description: "Search Criteria.md holds a copy. The daily scan uses it from the next run.", tone: "success" }); }
    catch (e) { toast({ title: "Could not activate", description: (e as Error).message, tone: "danger" }); }
    setBusy(false);
  };
  const remove = async () => {
    setBusy(true);
    try { await api.deleteCriteriaPreset(editing); setConfirmDelete(false); await loadPresets(); await load(ACTIVE); toast({ title: "Preset deleted", tone: "success" }); }
    catch (e) { toast({ title: "Could not delete", description: (e as Error).message, tone: "danger" }); }
    setBusy(false);
  };
  const runWith = async (dry: boolean) => {
    try { await api.startScan(dry, isPreset ? editing : undefined); toast({ title: dry ? "Dry run started" : "Scan started", description: `Scoring with ${isPreset ? `"${editing}"` : "the active criteria"}. Watch it on Runs.`, tone: "success" }); }
    catch (e) { toast({ title: "Could not start", description: (e as Error).message, tone: "danger" }); }
  };
  const previewImpact = async () => {
    setPreviewing(true);
    try { setPreview(await api.previewCriteria(raw)); }
    catch (e) { toast({ title: "Could not preview", description: (e as Error).message, tone: "danger" }); }
    setPreviewing(false);
  };
  const applyJson = () => {
    try { const parsed = JSON.parse(jsonText) as Doc; setDoc(parsed); setJsonError(""); }
    catch (e) { setJsonError((e as Error).message); }
  };

  if (!doc) return <Skeleton variant="rect" height="24rem" />;
  const salary = (doc.salary ?? {}) as { minAnnual?: number; stretchAnnual?: number };
  const sources = { ...Object.fromEntries(KNOWN_SOURCES.map((k) => [k, false])), ...((doc.openSources as Record<string, boolean>) ?? {}) };
  const current = presets.find((p) => p.name === editing);

  return (
    <>
      <div className="page__head">
        <div>
          <p>What the scan looks for and how it scores. Fields write into the JSON in {isPreset ? <code>Targets/Criteria/{editing}.md</code> : <code>Targets/Search Criteria.md</code>}; keys this form does not show are kept as they are.</p>
        </div>
        <div className="chips">
          <Badge tone="neutral" size="sm">bar {String(doc.minScore ?? "?")}</Badge>
          {salary.minAnnual && <Badge tone="success" size="sm">floor {money(salary.minAnnual)}</Badge>}
          {salary.stretchAnnual && <Badge tone="warning" size="sm">stretch {money(salary.stretchAnnual)}</Badge>}
          {dirty && <Badge tone="warning" size="sm">unsaved</Badge>}
        </div>
      </div>

      <Card padding="md">
        <div className="toolbar">
          <Select className="toolbar__filter toolbar__filter--wide" size="sm" label="Editing" value={editing} onValueChange={(v) => { if (dirty && !window.confirm("Discard unsaved changes?")) return; load(v); }}>
            <Select.Item value={ACTIVE}>Active criteria (daily scan)</Select.Item>
            {presets.map((p) => (
              <Select.Item key={p.name} value={p.name}>{p.name}{p.active ? " · same as active" : ""}</Select.Item>
            ))}
          </Select>
          <div className="toolbar__spacer" />
          <div className="toolbar__switch pager__buttons">
            {isPreset && <Button size="sm" variant="ghost" tone="danger" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete preset</Button>}
            {isPreset && <Button size="sm" variant="soft" disabled={busy || dirty || current?.active} onClick={activate}>{current?.active ? "Is the active set" : "Make active"}</Button>}
            <Button size="sm" variant="soft" disabled={busy || previewing} loading={previewing} onClick={previewImpact}>Preview impact</Button>
            <Button size="sm" variant="soft" disabled={busy} onClick={() => setSaveAs(isPreset ? `${editing} copy` : "")}>Save as preset…</Button>
            <Button size="sm" variant="soft" disabled={busy || dirty} onClick={() => runWith(true)}>Dry run with this</Button>
            <Button size="sm" variant="soft" disabled={busy || dirty} onClick={() => runWith(false)}>Scan with this</Button>
            <Button size="sm" tone="primary" disabled={!dirty || busy} loading={busy} onClick={save}>{isPreset ? "Save preset" : "Save to the vault"}</Button>
          </div>
        </div>
        {isPreset && current && <p className="muted">Preset · {current.titles} title terms · updated {current.updated} · {current.file}</p>}
      </Card>

      <Tabs defaultValue="fields" variant="line" size="sm">
        <Tabs.List aria-label="Criteria editors">
          <Tabs.Trigger value="fields">Fields</Tabs.Trigger>
          <Tabs.Trigger value="titles">Titles and terms</Tabs.Trigger>
          <Tabs.Trigger value="location">Location and pay</Tabs.Trigger>
          <Tabs.Trigger value="sources">Sources</Tabs.Trigger>
          <Tabs.Trigger value="json">JSON</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="fields">
          <Card padding="md">
            <div className="form">
              <div className="form__row">
                <Num doc={doc} path={["minScore"]} label="Bar (minScore)" hint="A posting needs this many points to become a note." onChange={update} />
                <Num doc={doc} path={["noTitleMatchPenalty"]} label="No title match penalty" hint="Taken when the title matches nothing in the title terms." onChange={update} />
              </div>
              <div className="form__row">
                <Num doc={doc} path={["descCap"]} label="Description points cap" hint="Description terms add up to this many points, no more." onChange={update} />
                <Num doc={doc} path={["maxDescriptionChars"]} label="Description characters kept in a note" onChange={update} step={500} />
              </div>
              <div className="form__row">
                <Num doc={doc} path={["titleExtraPer"]} label="Points per extra title match" onChange={update} />
                <Num doc={doc} path={["titleExtraCap"]} label="Extra title matches cap" onChange={update} />
              </div>
              <h3>Seniority</h3>
              <div className="form__row">
                <ListEditor label="Boost (word: points)" hint="Words in the title that add. Example: staff: 10" value={get(doc, ["seniority", "boost"])} weighted rows={6} onCommit={(v) => update(set(doc, ["seniority", "boost"], v))} />
                <ListEditor label="Penalty (word: points)" hint="Words in the title that subtract. Example: junior: -40" value={get(doc, ["seniority", "penalty"])} weighted rows={6} onCommit={(v) => update(set(doc, ["seniority", "penalty"], v))} />
              </div>
              <h3>Recency</h3>
              <div className="form__row">
                <Num doc={doc} path={["recency", "days2"]} label="Posted within 2 days" onChange={update} />
                <Num doc={doc} path={["recency", "days7"]} label="Within 7 days" onChange={update} />
              </div>
              <div className="form__row">
                <Num doc={doc} path={["recency", "days30"]} label="Within 30 days" onChange={update} />
                <Num doc={doc} path={["recency", "days90"]} label="Within 90 days" onChange={update} />
              </div>
              <div className="form__row">
                <Num doc={doc} path={["recency", "older"]} label="Older than 90 days" onChange={update} />
              </div>
            </div>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="titles">
          <Card padding="md">
            <div className="form">
              <div className="form__row">
                <ListEditor label="Title terms (term: weight)" hint="The best single match in the title counts fully; each extra match adds the per-extra points. One per line." value={doc.titleTerms} weighted rows={18} onCommit={(v) => update(set(doc, ["titleTerms"], v))} />
                <ListEditor label="Title exclusions (one per line)" hint="Any hit in the title drops the posting entirely." value={doc.titleExclude} weighted={false} rows={18} onCommit={(v) => update(set(doc, ["titleExclude"], v))} />
              </div>
              <ListEditor label="Description terms (term: weight)" hint="Each term found in the description adds its weight, up to the description cap." value={doc.descTerms} weighted rows={14} onCommit={(v) => update(set(doc, ["descTerms"], v))} />
            </div>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="location">
          <Card padding="md">
            <div className="form">
              <h3>Location</h3>
              <Switch label="Remote only" description="Anything not remote takes the penalty below, which drops it under the bar." checked={!!get(doc, ["location", "requireRemote"])} onCheckedChange={(v) => update(set(doc, ["location", "requireRemote"], v === true))} />
              <div className="form__row">
                <Num doc={doc} path={["location", "notRemotePenalty"]} label="Not remote penalty" onChange={update} />
                <Num doc={doc} path={["location", "remoteBoost"]} label="Remote boost" onChange={update} />
              </div>
              <div className="form__row">
                <Num doc={doc} path={["location", "nonUsPenalty"]} label="Non-US penalty" hint="Applied when the location names a place in the list below and nothing US." onChange={update} />
                <Num doc={doc} path={["location", "bayAreaBoost"]} label="Metro boost" hint="For the metro terms below. Set to 0 to switch it off." onChange={update} />
              </div>
              <div className="form__row">
                <ListEditor label="Metro terms (one per line)" hint="Places that earn the metro boost. The interview seeds these from your location; empty the list for no boost." value={get(doc, ["location", "bayAreaTerms"])} weighted={false} rows={8} onCommit={(v) => update(set(doc, ["location", "bayAreaTerms"], v))} />
                <ListEditor label="US terms (one per line)" hint="Words that mark a posting as US." value={get(doc, ["location", "usTerms"])} weighted={false} rows={8} onCommit={(v) => update(set(doc, ["location", "usTerms"], v))} />
              </div>
              <ListEditor label="Non-US terms (one per line)" hint="Places that trigger the non-US penalty. Whole words." value={get(doc, ["location", "nonUsTerms"])} weighted={false} rows={10} onCommit={(v) => update(set(doc, ["location", "nonUsTerms"], v))} />
              <h3>Pay</h3>
              <div className="form__row">
                <Num doc={doc} path={["salary", "minAnnual"]} label="Floor (annual)" hint="A stated range that tops out at or above this earns the bonus." onChange={update} step={5000} />
                <Num doc={doc} path={["salary", "stretchAnnual"]} label="Stretch (annual)" hint="Between stretch and floor is the stretch band: kept visible, small penalty." onChange={update} step={5000} />
              </div>
              <div className="form__row">
                <Num doc={doc} path={["salary", "meetsBonus"]} label="Meets floor bonus" onChange={update} />
                <Num doc={doc} path={["salary", "stretchPenalty"]} label="Stretch band penalty" onChange={update} />
              </div>
              <div className="form__row">
                <Num doc={doc} path={["salary", "belowPenalty"]} label="Below stretch penalty" onChange={update} />
                <Num doc={doc} path={["salary", "abovePer10k"]} label="Points per $10k above floor" hint={`Capped at ${String(get(doc, ["salary", "aboveCap"]) ?? "?")} (aboveCap).`} onChange={update} />
              </div>
            </div>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="sources">
          <Card padding="md">
            <div className="form">
              <p className="muted">Aggregator feeds with no company slug. Company boards live on the Companies page. Adzuna and USAJOBS also need a free key in the environment.</p>
              <div className="form__row">
                {Object.keys(sources).map((k) => (
                  <Switch key={k} label={SOURCE_LABEL[k] ?? k} checked={!!sources[k]} onCheckedChange={(v) => update(set(doc, ["openSources", k], v === true))} />
                ))}
              </div>
            </div>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="json">
          <Card padding="md">
            <div className="form">
              <TextArea label="Criteria JSON" description="The whole document. Apply to push it into the fields; Save to write it to the vault." font="mono" rows={28} resize="vertical" value={jsonText} onChange={(e) => setJsonText(e.target.value)} error={jsonError || undefined} />
              <div className="form__actions">
                <Button variant="ghost" size="sm" disabled={jsonText === raw} onClick={() => { setJsonText(raw); setJsonError(""); }}>Revert</Button>
                <Button variant="soft" size="sm" disabled={jsonText === raw} onClick={applyJson}>Apply to fields</Button>
              </div>
            </div>
          </Card>
        </Tabs.Content>
      </Tabs>

      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)} size="lg">
        <Dialog.Content>
          <Dialog.Title>What this set would do to the notes you have</Dialog.Title>
          <Dialog.Description>
            Against the active criteria. Covers {preview?.covers}. Nothing is written by a preview.
          </Dialog.Description>
          {preview && (
            <div className="preview">
              <div className="chips">
                <Badge size="sm" tone="neutral">{preview.openNotes} open notes</Badge>
                <Badge size="sm" tone={preview.changed ? "primary" : "neutral"}>{preview.changed} change score</Badge>
                <Badge size="sm" tone="neutral">bar {preview.barBefore} → {preview.barAfter}</Badge>
                <Badge size="sm" tone={preview.aboveAfter >= preview.aboveBefore ? "success" : "warning"}>above the bar {preview.aboveBefore} → {preview.aboveAfter}</Badge>
              </div>
              <div className="form__row">
                <Movers title="Rise above the bar" rows={preview.rise} empty="Nothing crosses upward." />
                <Movers title="Fall below the bar" rows={preview.fall} empty="Nothing drops out." />
              </div>
              <div className="form__row">
                <Movers title="Enter the top 20" rows={preview.enterTop20} empty="The top 20 keeps its members." />
                <Movers title="Leave the top 20" rows={preview.leaveTop20} empty="The top 20 keeps its members." />
              </div>
              <div className="form__row">
                <Movers title="Biggest gains" rows={preview.up} empty="No note gains points." />
                <Movers title="Biggest losses" rows={preview.down} empty="No note loses points." />
              </div>
            </div>
          )}
          <Dialog.Footer>
            <Dialog.Close asChild><Button variant="ghost" size="sm">Close</Button></Dialog.Close>
            {dirty && <Button size="sm" tone="primary" disabled={busy} onClick={() => { setPreview(null); save(); }}>{isPreset ? "Save preset" : "Save to the vault"}</Button>}
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>

      <Dialog open={saveAs !== null} onOpenChange={(o) => !o && setSaveAs(null)} size="sm">
        <Dialog.Content>
          <Dialog.Title>Save as a preset</Dialog.Title>
          <Dialog.Description>A named copy under Targets/Criteria/. The daily scan keeps using the active set until you make this one active.</Dialog.Description>
          <TextField label="Name" placeholder="Wider net, 180k floor" value={saveAs ?? ""} onChange={(e) => setSaveAs(e.target.value)} />
          <Dialog.Footer>
            <Dialog.Close asChild><Button variant="ghost" size="sm">Cancel</Button></Dialog.Close>
            <Button size="sm" tone="primary" disabled={!saveAs?.trim() || busy} loading={busy} onClick={saveAsPreset}>Save preset</Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete} size="sm">
        <Dialog.Content>
          <Dialog.Title>Delete "{editing}"?</Dialog.Title>
          <Dialog.Description>Removes the note under Targets/Criteria/. The active criteria and every job note stay as they are.</Dialog.Description>
          <Dialog.Footer>
            <Dialog.Close asChild><Button variant="ghost" size="sm">Keep it</Button></Dialog.Close>
            <Button size="sm" tone="danger" disabled={busy} loading={busy} onClick={remove}>Delete</Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    </>
  );
}
