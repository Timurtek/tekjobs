import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Avatar, Badge, Kanban, type KanbanMove } from "@/components/ui";
import { argTypesFor, classNameAllow } from "./manifest";

interface Ticket {
  id: string;
  title: string;
  column: string;
  owner: string;
  priority: "low" | "high";
}

const COLUMNS = [
  { id: "triage", title: "Triage" },
  { id: "doing", title: "In progress", limit: 2 },
  { id: "review", title: "In review" },
  { id: "done", title: "Done" },
];

const TICKETS: Ticket[] = [
  { id: "t1", title: "Rewrite the import parser", column: "triage", owner: "Mina Okafor", priority: "high" },
  { id: "t2", title: "Spacing scale drifts on mobile", column: "triage", owner: "Rafa Silva", priority: "low" },
  { id: "t3", title: "Token audit for the dark theme", column: "doing", owner: "Ines Berg", priority: "high" },
  { id: "t4", title: "Storybook a11y addon warnings", column: "doing", owner: "Mina Okafor", priority: "low" },
  { id: "t5", title: "Drop the legacy button variants", column: "review", owner: "Sam Ojo", priority: "low" },
];

function Board({ density }: { density?: "sm" | "md" }) {
  const [tickets, setTickets] = useState(TICKETS);
  const move = ({ cardId, to, index }: KanbanMove) => {
    setTickets((current) => {
      const card = current.find((t) => t.id === cardId);
      if (!card) return current;
      const rest = current.filter((t) => t.id !== cardId);
      const before = rest.filter((t) => t.column === to).slice(0, index);
      const at = before.length ? rest.indexOf(before[before.length - 1]!) + 1 : rest.findIndex((t) => t.column === to);
      const next = [...rest];
      next.splice(at === -1 ? next.length : at, 0, { ...card, column: to });
      return next;
    });
  };

  return (
    <Kanban
      label="Sprint board"
      density={density}
      columns={COLUMNS}
      cards={tickets}
      cardId={(t) => t.id}
      cardColumn={(t) => t.column}
      cardLabel={(t) => t.title}
      onMove={move}
      renderCard={(t) => (
        <div style={{ display: "grid", gap: "var(--spacing-2)" }}>
          <strong style={{ fontSize: "var(--text-sm)" }}>{t.title}</strong>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--spacing-2)" }}>
            <Avatar name={t.owner} size="sm" />
            <Badge size="sm" tone={t.priority === "high" ? "danger" : "neutral"} variant="outline">
              {t.priority}
            </Badge>
          </div>
        </div>
      )}
    />
  );
}

const meta = {
  title: "Kanban",
  component: Kanban,
  tags: ["autodocs"],
  argTypes: argTypesFor("Kanban"),
  args: {
    label: "Sprint board",
    columns: COLUMNS,
    cards: TICKETS,
    cardId: (t: Ticket) => t.id,
    cardColumn: (t: Ticket) => t.column,
    cardLabel: (t: Ticket) => t.title,
    renderCard: (t: Ticket) => t.title,
    density: "md" as const,
  },
  parameters: {
    docs: {
      description: {
        component: `A board of columns you can move cards between, with a pointer or with the keyboard. Space lifts a card, the arrows move it, Enter drops it, Escape puts it back. ${classNameAllow("Kanban")}`,
      },
    },
  },
} satisfies Meta<typeof Kanban<Ticket>>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Move a card with the mouse, or focus one and press Space. */
export const Board_: Story = { name: "Board", render: () => <Board /> };

export const Compact: Story = { name: "Compact", render: () => <Board density="sm" /> };

/** A column past its limit says so, rather than silently accepting the work. */
export const OverTheLimit: Story = {
  render: () => (
    <Kanban
      label="Sprint board"
      columns={[{ id: "doing", title: "In progress", limit: 2 }]}
      cards={TICKETS.filter((t) => t.column === "doing").concat({ ...TICKETS[0]!, id: "t9", column: "doing" })}
      cardId={(t) => t.id}
      cardColumn={() => "doing"}
      cardLabel={(t) => t.title}
      renderCard={(t) => t.title}
    />
  ),
};

/** An empty column is a drop target too, and says what it is. */
export const EmptyColumn: Story = {
  render: () => (
    <Kanban
      label="Sprint board"
      columns={COLUMNS}
      cards={[]}
      cardId={(t: Ticket) => t.id}
      cardColumn={(t: Ticket) => t.column}
      cardLabel={(t: Ticket) => t.title}
      renderCard={(t: Ticket) => t.title}
    />
  ),
};
