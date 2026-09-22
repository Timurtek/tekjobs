/* zengin-owned Kanban, forked from @zenginui/ui@0.2.2, sha e11d17b92bf1 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Badge } from "../badge/badge";
import { EmptyState } from "../empty-state/empty-state";

export type KanbanDensity = "sm" | "md";

export interface KanbanColumn {
  id: string;
  title: ReactNode;
  /** Shown beside the title when the column is over its limit, and used to tint the count. */
  limit?: number;
  /** What to show when this column is empty. */
  empty?: ReactNode;
}

export interface KanbanMove {
  cardId: string;
  from: string;
  to: string;
  /** Where in the destination column, counting only the cards that remain after the card is lifted. */
  index: number;
}

export interface KanbanProps<Card> {
  columns: KanbanColumn[];
  cards: Card[];
  cardId: (card: Card) => string;
  /** Which column a card is in. */
  cardColumn: (card: Card) => string;
  /** What to draw inside the card. */
  renderCard: (card: Card) => ReactNode;
  /**
   * A name for each card, for anyone not looking at the board. Announced when the card is picked up and
   * when it lands, so a keyboard user knows what moved and where.
   */
  cardLabel: (card: Card) => string;
  /** Called with the move. The board is controlled: nothing reorders until the caller says so. */
  onMove?: (move: KanbanMove) => void;
  density?: KanbanDensity;
  /** Required: a board needs a name. */
  label: string;
  className?: string;
}

/**
 * A board of columns you can move cards between, with a pointer or with the keyboard.
 *
 * Every operations app rebuilds this, and the rebuild is usually pointer-only: HTML5 drag events, a drop
 * handler, done. That version cannot be used with a keyboard at all, and drag-and-drop has no accessible
 * fallback of its own, so the keyboard path is not a nicety here but the difference between a component and
 * a demo. Space or Enter lifts a card, the arrow keys move it between and within columns, Enter drops it and
 * Escape puts it back. Both paths end in the same `onMove`.
 *
 * The board is controlled. It reports where a card should go and draws whatever it is given, so an app that
 * needs to save the move, refuse it, or animate it stays in charge of all three.
 */
export function Kanban<Card>({
  columns,
  cards,
  cardId,
  cardColumn,
  renderCard,
  cardLabel,
  onMove,
  density = "md",
  label,
  className,
}: KanbanProps<Card>) {
  const [lifted, setLifted] = useState<{ id: string; column: string; index: number } | null>(null);
  const [over, setOver] = useState<{ column: string; index: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const boardId = useId();
  const cardRefs = useRef(new Map<string, HTMLElement>());

  const inColumn = useCallback((columnId: string) => cards.filter((c) => cardColumn(c) === columnId), [cards, cardColumn]);

  const commit = useCallback(
    (cardKey: string, from: string, to: string, index: number) => {
      if (from === to) {
        const same = inColumn(from).findIndex((c) => cardId(c) === cardKey);
        if (same === index) return;
      }
      onMove?.({ cardId: cardKey, from, to, index });
    },
    [inColumn, cardId, onMove],
  );

  // Focus follows the card after a keyboard move, so the next key press continues the same journey.
  useEffect(() => {
    if (!lifted) return;
    cardRefs.current.get(lifted.id)?.focus();
  }, [lifted, cards]);

  const drop = (columnId: string, index: number) => {
    if (!lifted) return;
    commit(lifted.id, lifted.column, columnId, index);
    setLifted(null);
    setOver(null);
  };

  const onCardKeyDown = (event: KeyboardEvent<HTMLElement>, card: Card, columnIndex: number, index: number) => {
    // `renderCard` is the extension point, and the most common thing to put in it is a per-card menu. A
    // keydown from a control inside the card belongs to that control: Space on its menu button used to open
    // the menu *and* lift the card, and Escape afterwards was ambiguous for the same reason.
    if (event.target !== event.currentTarget) return;

    const id = cardId(card);
    const key = event.key;

    if (key === " " || key === "Enter") {
      event.preventDefault();
      if (!lifted) {
        setLifted({ id, column: cardColumn(card), index });
        setAnnouncement(`${cardLabel(card)} lifted. Use the arrow keys to move it, Enter to drop, Escape to cancel.`);
      } else {
        const target = over ?? { column: lifted.column, index: lifted.index };
        const column = columns.find((c) => c.id === target.column);
        commit(lifted.id, lifted.column, target.column, target.index);
        setAnnouncement(`${cardLabel(card)} moved to ${typeof column?.title === "string" ? column.title : target.column}, position ${target.index + 1}.`);
        setLifted(null);
        setOver(null);
      }
      return;
    }

    if (key === "Escape" && lifted) {
      event.preventDefault();
      setAnnouncement(`${cardLabel(card)} put back.`);
      setLifted(null);
      setOver(null);
      return;
    }

    if (!lifted) return;
    const current = over ?? { column: lifted.column, index: lifted.index };
    const currentColumn = columns.findIndex((c) => c.id === current.column);

    if (key === "ArrowLeft" || key === "ArrowRight") {
      event.preventDefault();
      const next = columns[currentColumn + (key === "ArrowRight" ? 1 : -1)];
      if (!next) return;
      const size = inColumn(next.id).filter((c) => cardId(c) !== lifted.id).length;
      const at = Math.min(current.index, size);
      setOver({ column: next.id, index: at });
      setAnnouncement(`Over ${typeof next.title === "string" ? next.title : next.id}, position ${at + 1}.`);
      return;
    }

    if (key === "ArrowUp" || key === "ArrowDown") {
      event.preventDefault();
      const size = inColumn(current.column).filter((c) => cardId(c) !== lifted.id).length;
      const at = Math.max(0, Math.min(size, current.index + (key === "ArrowDown" ? 1 : -1)));
      setOver({ column: current.column, index: at });
      setAnnouncement(`Position ${at + 1}.`);
    }
    void columnIndex;
  };

  return (
    <div className={cx("z-kanban", className)} data-density={density} role="group" aria-label={label}>
      {/* The only channel a keyboard user has for a move they cannot see happening. */}
      <p className="z-sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {columns.map((column, columnIndex) => {
        const columnCards = inColumn(column.id);
        const overThis = over?.column === column.id;
        const overLimit = column.limit !== undefined && columnCards.length > column.limit;
        return (
          <section
            key={column.id}
            className="z-kanban__column"
            data-over={overThis || undefined}
            aria-labelledby={`${boardId}-${column.id}`}
            onDragOver={(e) => {
              if (!lifted) return;
              e.preventDefault();
              setOver({ column: column.id, index: columnCards.filter((c) => cardId(c) !== lifted.id).length });
            }}
            onDrop={(e) => {
              e.preventDefault();
              drop(column.id, over?.column === column.id ? over.index : columnCards.length);
            }}
          >
            <header className="z-kanban__head">
              <h3 className="z-kanban__title" id={`${boardId}-${column.id}`}>
                {column.title}
              </h3>
              <Badge size="sm" tone={overLimit ? "warning" : "neutral"} variant="outline">
                {column.limit === undefined ? columnCards.length : `${columnCards.length}/${column.limit}`}
              </Badge>
            </header>

            <ul className="z-kanban__list">
              {columnCards.map((card, index) => {
                const id = cardId(card);
                const isLifted = lifted?.id === id;
                return (
                  <li key={id} className="z-kanban__slot" data-drop={overThis && over?.index === index ? "" : undefined}>
                    <article
                      ref={(el) => {
                        if (el) cardRefs.current.set(id, el);
                        else cardRefs.current.delete(id);
                      }}
                      className="z-kanban__card z-focusable"
                      tabIndex={0}
                      draggable
                      data-lifted={isLifted || undefined}
                      aria-roledescription="Draggable card"
                      aria-label={cardLabel(card)}
                      aria-grabbed={isLifted || undefined}
                      onKeyDown={(e) => onCardKeyDown(e, card, columnIndex, index)}
                      onDragStart={() => setLifted({ id, column: column.id, index })}
                      onDragEnd={() => {
                        setLifted(null);
                        setOver(null);
                      }}
                    >
                      {renderCard(card)}
                    </article>
                  </li>
                );
              })}
              {columnCards.length === 0 && (
                <li className="z-kanban__slot" data-drop={overThis ? "" : undefined}>
                  {column.empty ?? <EmptyState size="sm" title="Nothing here" />}
                </li>
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
