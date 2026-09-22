import { Badge, Button, Card, Dialog, Icon, Select, Skeleton, Table, TextField, toast } from "@/components/ui";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api, type Company } from "../api";

const ATS = ["greenhouse", "lever", "ashby", "workday", "rippling", "smartrecruiters", "workable", "bamboohr", "breezy", "personio", "teamtailor", "eightfold"];

export function Companies() {
  const [rows, setRows] = useState<Company[] | null>(null);
  const [q, setQ] = useState("");
  const [tier, setTier] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", ats: "greenhouse", slug: "", tier: "B", notes: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.companies().then(setRows).catch((e: Error) => toast({ title: "Could not load the watchlist", description: e.message, tone: "danger" })); }, []);
  const visible = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return (rows ?? []).filter((c) => (tier === "all" || c.tier === tier) && (!ql || `${c.name} ${c.ats} ${c.slug}`.toLowerCase().includes(ql)));
  }, [rows, q, tier]);
  const bad = (rows ?? []).filter((c) => c.status.startsWith("bad-slug")).length;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const updated = await api.addCompany(form);
      setRows(updated); setOpen(false); setForm({ name: "", ats: "greenhouse", slug: "", tier: "B", notes: "" });
      toast({ title: `${form.name} added`, description: "It is fetched on the next scan.", tone: "success" });
    } catch (err) { toast({ title: "Not added", description: (err as Error).message, tone: "danger" }); }
    setBusy(false);
  };

  return (
    <>
      <div className="toolbar">
        <TextField className="toolbar__search" size="sm" label="Search" placeholder="Company, platform or slug" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select className="toolbar__filter" size="sm" label="Tier" value={tier} onValueChange={setTier}>
          <Select.Item value="all">All tiers</Select.Item>
          <Select.Item value="A">A, dream</Select.Item>
          <Select.Item value="B">B, strong</Select.Item>
          <Select.Item value="C">C, fine</Select.Item>
        </Select>
        <span className="toolbar__spacer" />
        {bad > 0 && <Badge tone="warning" size="sm">{bad} bad slug{bad === 1 ? "" : "s"}</Badge>}
        <Dialog open={open} onOpenChange={setOpen} size="sm">
          <Dialog.Trigger asChild>
            <Button tone="primary" size="sm" leadingIcon={<Icon.Plus />}>Add a board</Button>
          </Dialog.Trigger>
          <Dialog.Content>
            <form className="form" onSubmit={submit}>
              <Dialog.Title>Watch a company board</Dialog.Title>
              <Dialog.Description>The slug is the board token in the careers URL. Rows are appended to Targets/Companies.md.</Dialog.Description>
              <TextField label="Company" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <div className="form__row">
                <Select label="Platform" value={form.ats} onValueChange={(v) => setForm({ ...form, ats: v })}>
                  {ATS.map((a) => (
                    <Select.Item key={a} value={a}>{a}</Select.Item>
                  ))}
                </Select>
                <Select label="Tier" value={form.tier} onValueChange={(v) => setForm({ ...form, tier: v })}>
                  <Select.Item value="A">A</Select.Item>
                  <Select.Item value="B">B</Select.Item>
                  <Select.Item value="C">C</Select.Item>
                </Select>
              </div>
              <TextField label="Slug" required description={form.ats === "workday" ? "host/tenant/site" : form.ats === "eightfold" ? "host/domain" : "as it appears in the board URL"} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
              <TextField label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <Dialog.Footer>
                <Dialog.Close asChild><Button variant="ghost">Cancel</Button></Dialog.Close>
                <Button type="submit" tone="primary" loading={busy}>Add</Button>
              </Dialog.Footer>
            </form>
          </Dialog.Content>
        </Dialog>
      </div>

      <Card padding="none">
        {rows === null ? (
          <div className="loading"><Skeleton lines={8} /></div>
        ) : (
          <Table aria-label="Company watchlist" density="md" stickyHeader>
            <Table.Head>
              <Table.Row>
                <Table.HeadCell>Company</Table.HeadCell>
                <Table.HeadCell>Platform</Table.HeadCell>
                <Table.HeadCell>Slug</Table.HeadCell>
                <Table.HeadCell>Tier</Table.HeadCell>
                <Table.HeadCell>Last fetch</Table.HeadCell>
                <Table.HeadCell>Notes</Table.HeadCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {visible.map((c) => (
                <Table.Row key={`${c.ats}:${c.slug}`}>
                  <Table.Cell>{c.name}</Table.Cell>
                  <Table.Cell><span className="muted">{c.ats}</span></Table.Cell>
                  <Table.Cell><code className="mono">{c.slug}</code></Table.Cell>
                  <Table.Cell><Badge tone={c.tier === "A" ? "primary" : "neutral"} size="sm">{c.tier || "—"}</Badge></Table.Cell>
                  <Table.Cell>
                    {c.status.startsWith("bad-slug") ? <Badge tone="danger" size="sm">{c.status}</Badge> : <span className="muted">{c.status || "not yet"}</span>}
                  </Table.Cell>
                  <Table.Cell><span className="muted">{c.notes}</span></Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Card>
      <p className="muted">{visible.length} of {rows?.length ?? 0} boards. Aggregator feeds are toggled in Criteria under <code className="mono">openSources</code>.</p>
    </>
  );
}
