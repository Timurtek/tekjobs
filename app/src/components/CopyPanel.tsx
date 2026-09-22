import { Button, Icon, Popover, Sheet, Skeleton, TextArea, TextField, toast, Tooltip } from "@/components/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Snippet, type Snippets } from "../api";

/**
 * The copy panel: one click puts a standard answer on the clipboard (email, phone, a link, the availability
 * line, whatever the person added). It exists because application forms ask for the same twelve things and
 * each one used to mean opening another tab. The list is the person's own, in Profile/Snippets.md.
 */
export function CopyPanel() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Snippets | null>(null);
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const load = () => api.snippets().then(setData).catch((e: Error) => toast({ title: "Could not load the copy panel", description: e.message, tone: "danger" }));
  useEffect(() => { if (open && !data) load(); }, [open]);
  useEffect(() => { if (open) setTimeout(() => search.current?.focus(), 30); else setQ(""); }, [open]);

  const groups = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const items = (data?.items ?? []).filter((s) => s.value && (!ql || `${s.group} ${s.label} ${s.value}`.toLowerCase().includes(ql)));
    const by = new Map<string, Snippet[]>();
    for (const s of items) { const g = s.group || "Other"; if (!by.has(g)) by.set(g, []); by.get(g)!.push(s); }
    return [...by.entries()];
  }, [data, q]);

  const copy = async (s: Snippet) => {
    try {
      await navigator.clipboard.writeText(s.value);
      setCopied(s.label);
      setTimeout(() => setCopied((c) => (c === s.label ? null : c)), 1600);
    } catch (e) { toast({ title: "Could not copy", description: (e as Error).message, tone: "danger" }); }
  };
  // Enter on the search copies the first match, so the whole thing is: open, type three letters, Enter.
  const first = groups[0]?.[1][0];

  return (
    <>
      <Popover open={open} onOpenChange={setOpen} size="lg">
        <Tooltip content="Copy panel">
          <Popover.Trigger asChild>
            <Button variant="ghost" size="sm" aria-label="Copy panel" leadingIcon={<Icon.Copy />} />
          </Popover.Trigger>
        </Tooltip>
        <Popover.Content align="end" showArrow={false}>
          <div className="copy">
            <form className="copy__search" onSubmit={(e) => { e.preventDefault(); if (first) copy(first); }}>
              <TextField ref={search} size="sm" aria-label="Find a snippet" placeholder="Find, then Enter copies the first" leadingIcon={<Icon.Search />} value={q} onChange={(e) => setQ(e.target.value)} />
            </form>
            {!data ? <Skeleton lines={4} /> : groups.length === 0 ? (
              <p className="muted copy__empty">{data.items.length === 0 ? "Nothing here yet. Customize adds lines." : q ? "Nothing matches." : "Every snippet is empty. Customize fills them in."}</p>
            ) : (
              <div className="copy__groups">
                {groups.map(([g, items]) => (
                  <div key={g} className="copy__group">
                    <div className="microlabel">{g}</div>
                    {items.map((s) => (
                      <Button key={`${g}:${s.label}`} asChild variant="ghost" tone="neutral" size="sm" align="start" className="copy__row">
                        <button type="button" onClick={() => copy(s)} title={s.value}>
                          <span className="copy__label">{s.label}</span>
                          <span className="copy__value num">{copied === s.label ? "Copied" : s.value.split("\n")[0]}{s.value.includes("\n") && copied !== s.label ? " …" : ""}</span>
                        </button>
                      </Button>
                    ))}
                  </div>
                ))}
              </div>
            )}
            <div className="copy__foot">
              <Button size="sm" variant="ghost" tone="neutral" leadingIcon={<Icon.Edit />} onClick={() => { setOpen(false); setEditing(true); }}>Customize</Button>
              {data && !data.exists && <span className="muted">Read from your profile until you save once.</span>}
            </div>
          </div>
        </Popover.Content>
      </Popover>
      {editing && data && <SnippetEditor initial={data.items} path={data.path} onClose={() => setEditing(false)} onSaved={(d) => { setData(d); setEditing(false); }} />}
    </>
  );
}

/** Edit the list: label, group, value, order. Saved to Profile/Snippets.md, which Obsidian can edit too. */
function SnippetEditor({ initial, path, onClose, onSaved }: { initial: Snippet[]; path: string; onClose: () => void; onSaved: (d: Snippets) => void }) {
  const [rows, setRows] = useState<Snippet[]>(initial.length ? initial : [{ group: "", label: "", value: "" }]);
  const [busy, setBusy] = useState(false);
  const update = (i: number, patch: Partial<Snippet>) => setRows((r) => r.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) => setRows((r) => { const j = i + d; if (j < 0 || j >= r.length) return r; const n = [...r]; [n[i], n[j]] = [n[j]!, n[i]!]; return n; });
  const remove = (i: number) => setRows((r) => r.filter((_, j) => j !== i));
  const save = async () => {
    setBusy(true);
    try { const d = await api.saveSnippets(rows); toast({ title: "Copy panel saved", description: "Profile/Snippets.md", tone: "success" }); onSaved(d); }
    catch (e) { toast({ title: "Not saved", description: (e as Error).message, tone: "danger" }); }
    setBusy(false);
  };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} side="right" size="md">
      <Sheet.Content>
        <div className="detail">
          <Sheet.Title>Customize the copy panel</Sheet.Title>
          <Sheet.Description>Label is the button, group is its heading, value is what lands on the clipboard. Lines with no label are dropped. Saved to <code className="mono">{path.split(/[\\/]/).slice(-2).join("/")}</code>, so Obsidian works too.</Sheet.Description>
          <div className="copy__rows">
            {rows.map((s, i) => (
              <div key={i} className="copy__edit">
                <div className="form__row">
                  <TextField size="sm" label="Label" value={s.label} onChange={(e) => update(i, { label: e.target.value })} />
                  <TextField size="sm" label="Group" value={s.group} onChange={(e) => update(i, { group: e.target.value })} />
                </div>
                <TextArea label="Value" rows={s.value.includes("\n") ? 4 : 1} value={s.value} onChange={(e) => update(i, { value: e.target.value })} />
                <div className="copy__edit-actions">
                  <Button size="sm" variant="ghost" tone="neutral" aria-label="Move up" leadingIcon={<Icon.ArrowUp />} disabled={i === 0} onClick={() => move(i, -1)} />
                  <Button size="sm" variant="ghost" tone="neutral" aria-label="Move down" leadingIcon={<Icon.ArrowDown />} disabled={i === rows.length - 1} onClick={() => move(i, 1)} />
                  <Button size="sm" variant="ghost" tone="danger" aria-label="Remove" leadingIcon={<Icon.Trash />} onClick={() => remove(i)} />
                </div>
              </div>
            ))}
          </div>
          <div className="form__actions">
            <Button size="sm" variant="soft" tone="neutral" leadingIcon={<Icon.Plus />} onClick={() => setRows((r) => [...r, { group: r[r.length - 1]?.group ?? "", label: "", value: "" }])}>Add a line</Button>
            <span className="toolbar__spacer" />
            <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button size="sm" tone="primary" loading={busy} onClick={save}>Save</Button>
          </div>
        </div>
      </Sheet.Content>
    </Sheet>
  );
}
