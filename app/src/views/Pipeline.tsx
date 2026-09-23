import { Badge, Button, Combobox, Icon, Kanban, Menu, Skeleton, toast, type KanbanMove } from "@/components/ui";
import { useEffect, useMemo, useState } from "react";
import { isPosted, PostedMark } from "@/components/PostedMark";
import { api, BAND_TONE, shortPay, STATUSES, type Job, type JobRow, type Status } from "../api";
import { JobSheet } from "./Jobs";

// The board is committed work only. New matches are decided on Today (shortlist or pass) and searched in
// Jobs; putting hundreds of them in a first column made the board read as the inventory again (2026-09-21
// audit, P1).
const COLUMNS: { id: Status; title: string; limit?: number }[] = [
  { id: "reviewing", title: "Reviewing" },
  { id: "applying", title: "Applying", limit: 5 },
  { id: "ready", title: "Ready", limit: 5 },
  { id: "applied", title: "Applied" },
  { id: "interviewing", title: "Interviewing" },
  { id: "offer", title: "Offer" },
];

const ON_BOARD = new Set<Status>(COLUMNS.map((c) => c.id));

export function Pipeline() {
  const [rows, setRows] = useState<JobRow[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [companies, setCompanies] = useState<string[]>([]);

  const load = () =>
    api
      .jobs({ status: "all", limit: 2000 })
      .then((r) => setRows(r.rows))
      .catch((e: Error) => toast({ title: "Could not load the board", description: e.message, tone: "danger" }));
  useEffect(() => {
    load();
  }, []);

  const move = async (id: string, status: Status) => {
    const row = rows?.find((r) => r.id === id);
    if (!row || row.status === status) return;
    setRows((rs) => (rs ? rs.map((r) => (r.id === id ? { ...r, status } : r)) : rs));
    try {
      await api.setStatus(id, status);
      toast({ title: `${row.company}: ${status}`, tone: "success" });
    } catch (e) {
      toast({ title: "Move not saved", description: (e as Error).message, tone: "danger" });
      load();
    }
  };

  const onChanged = (job: Job) =>
    setRows((rs) => (rs ? rs.map((r) => (r.id === job.id ? { ...r, status: job.status } : r)) : rs));

  // Every company with something live on the board, most-loaded first. Too many for a Select, which is
  // the whole reason Combobox exists.
  const companyOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows ?? []) if (ON_BOARD.has(r.status)) counts.set(r.company, (counts.get(r.company) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([company, n]) => ({ value: company, label: company, hint: `${n} on the board` }));
  }, [rows]);

  if (!rows) return <Skeleton variant="rect" height="20rem" />;

  const picked = new Set(companies);
  const cards = rows
    .filter((r) => ON_BOARD.has(r.status) && (picked.size === 0 || picked.has(r.company)))
    .sort((a, b) => b.score - a.score);
  const unreviewed = rows.filter((r) => r.status === "new").length;
  const closed = rows.filter((r) => r.status === "rejected" || r.status === "passed").length;

  return (
    <>
      <div className="page__head">
        <div>
          <p>
            Committed work only. Drag a card, or focus one and press Space to lift it, arrows to move it, Enter
            to drop. Every move is written to the job note.
            {unreviewed ? ` ${unreviewed} new matches wait on Today, not here.` : ""}
            {closed ? ` ${closed} closed are not shown.` : ""}
          </p>
        </div>
      </div>

      <div className="toolbar">
        <Combobox
          className="toolbar__filter toolbar__filter--wide"
          size="sm"
          multiple
          label="Companies"
          placeholder={companies.length ? "" : "All companies"}
          description="Narrow the board to the companies you are actually working."
          emptyMessage="No company on the board matches that."
          options={companyOptions}
          value={companies}
          onValueChange={setCompanies}
        />
      </div>

      <Kanban
        label="Job pipeline"
        columns={COLUMNS}
        cards={cards}
        cardId={(r) => r.id}
        cardColumn={(r) => r.status}
        cardLabel={(r) => `${r.title} at ${r.company}`}
        onMove={(m: KanbanMove) => move(m.cardId, m.to as Status)}
        renderCard={(r) => (
          <div className="kcard" data-posted={isPosted(r.source) || undefined} onClick={() => setSelected(r.id)}>
            <div className="kcard__head">
              <span className="kcard__company posted-co">{r.company}{isPosted(r.source) && <PostedMark />}</span>
              <Menu>
                <Menu.Trigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Move ${r.title}`}
                    leadingIcon={<Icon.More />}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Menu.Trigger>
                <Menu.Content align="end" onClick={(e) => e.stopPropagation()}>
                  {STATUSES.filter((st) => st !== r.status).map((st) => (
                    <Menu.Item key={st} onSelect={() => move(r.id, st)}>
                      Move to {st}
                    </Menu.Item>
                  ))}
                </Menu.Content>
              </Menu>
            </div>
            <span className="kcard__title">{r.title}</span>
            <div className="kcard__meta num">
              <span className="kcard__score">{r.score}</span>
              {r.salaryMax > 0 && <span className={r.payBand === "floor" ? "kcard__pay kcard__pay--floor" : "kcard__pay"}>{shortPay(r.salary)}</span>}
            </div>
          </div>
        )}
      />

      <JobSheet id={selected} onClose={() => setSelected(null)} onChanged={onChanged} />
    </>
  );
}
