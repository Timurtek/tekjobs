/* zengin-owned Table, forked from @zenginui/ui@0.1.0, sha 26299c0574b8; stacked phone layout added by TekJobs */
import { forwardRef, useLayoutEffect, useRef, type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

export type TableDensity = "sm" | "md";
export type TableAlign = "start" | "center" | "end";
/** How a cell takes part in the phone card: the card's headline, a line beside its label (the default), a line
 *  under its label for long text, or left off the phone altogether. */
export type TableStackRole = "title" | "line" | "full" | "hidden";

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /** Row height and type size. `sm` for dense data, `md` for reading. */
  density?: TableDensity;
  /** Keep the header row visible while the body scrolls inside the container. */
  stickyHeader?: boolean;
  /**
   * At phone width, show each row as a card instead of a squeezed grid (Apple HIG: tables become list rows on a
   * compact screen; never shrink a desktop table to fit a phone). Every cell is labelled with its column's
   * header, read from the header row, so a table needs nothing else to stack. Set `false` only for data that is
   * genuinely a grid.
   */
  stack?: boolean;
}

/**
 * A data table with its scroll container. Parts: Head, Body, Foot, Row, Cell, HeadCell. Cells align with
 * `align`; numeric columns should align `end` and set `numeric` for tabular figures. At phone width rows stack
 * into cards; `stackRole` on a cell picks the card's headline and what to leave off.
 */
const Root = forwardRef<HTMLTableElement, TableProps>(function Table({ density = "md", stickyHeader = false, stack = true, className, style, ...rest }, ref) {
  const box = useRef<HTMLDivElement>(null);
  // Label every body cell with its column header, for the stacked layout. Runs after every render of the table,
  // which is when its rows can change; a header with a sort button labels by its text.
  useLayoutEffect(() => {
    const el = box.current;
    if (!stack || !el) return;
    const heads: string[] = [];
    el.querySelectorAll<HTMLTableCellElement>("thead tr:last-child th").forEach((th) => {
      for (let i = 0; i < (th.colSpan || 1); i++) heads.push((th.getAttribute("aria-label") || th.textContent || "").trim());
    });
    el.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((tr) => {
      let col = 0;
      for (const td of Array.from(tr.cells)) {
        const label = td.colSpan > 1 ? "" : heads[col] ?? "";
        if (label) td.setAttribute("data-label", label); else td.removeAttribute("data-label");
        col += td.colSpan || 1;
      }
    });
  });
  // className and style place the scroll container (a max-height makes the header sticky); the rest describes the table.
  return (
    <div ref={box} className={cx("z-table", className)} style={style} data-density={density} data-sticky={stickyHeader || undefined} data-stack={stack || undefined}>
      <table ref={ref} className="z-table__table" {...rest} />
    </div>
  );
});

const Head = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(function TableHead({ className, ...rest }, ref) {
  return <thead ref={ref} className={cx("z-table__head", className)} {...rest} />;
});

const Body = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(function TableBody({ className, ...rest }, ref) {
  return <tbody ref={ref} className={cx("z-table__body", className)} {...rest} />;
});

const Foot = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(function TableFoot({ className, ...rest }, ref) {
  return <tfoot ref={ref} className={cx("z-table__foot", className)} {...rest} />;
});

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Marks the row as selected: a tinted background. */
  selected?: boolean;
  /** Rows that respond to a click get a hover state and a pointer. */
  interactive?: boolean;
}

const Row = forwardRef<HTMLTableRowElement, TableRowProps>(function TableRow({ selected, interactive, className, ...rest }, ref) {
  return <tr ref={ref} className={cx("z-table__row", className)} data-selected={selected || undefined} data-interactive={interactive || undefined} aria-selected={selected} {...rest} />;
});

export interface TableCellProps extends Omit<TdHTMLAttributes<HTMLTableCellElement>, "align"> {
  align?: TableAlign;
  /** Tabular figures, so digits line up down the column. */
  numeric?: boolean;
  /** Its part in the phone card. Default `line`: the value beside its column label. */
  stackRole?: TableStackRole;
}

const Cell = forwardRef<HTMLTableCellElement, TableCellProps>(function TableCell({ align = "start", numeric, stackRole = "line", className, ...rest }, ref) {
  return <td ref={ref} className={cx("z-table__cell", className)} data-align={align} data-numeric={numeric || undefined} data-stack-role={stackRole} {...rest} />;
});

export interface TableHeadCellProps extends Omit<ThHTMLAttributes<HTMLTableCellElement>, "align"> {
  align?: TableAlign;
  numeric?: boolean;
}

const HeadCell = forwardRef<HTMLTableCellElement, TableHeadCellProps>(function TableHeadCell({ align = "start", numeric, className, scope = "col", ...rest }, ref) {
  return <th ref={ref} className={cx("z-table__cell z-table__cell--head", className)} data-align={align} data-numeric={numeric || undefined} scope={scope} {...rest} />;
});

export const Table = Object.assign(Root, { Head, Body, Foot, Row, Cell, HeadCell });
