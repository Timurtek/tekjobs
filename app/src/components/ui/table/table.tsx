/* zengin-owned Table, forked from @zenginui/ui@0.1.0, sha 26299c0574b8 */
import { forwardRef, type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

export type TableDensity = "sm" | "md";
export type TableAlign = "start" | "center" | "end";

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /** Row height and type size. `sm` for dense data, `md` for reading. */
  density?: TableDensity;
  /** Keep the header row visible while the body scrolls inside the container. */
  stickyHeader?: boolean;
}

/**
 * A data table with its scroll container. Parts: Head, Body, Foot, Row, Cell, HeadCell. Cells align with
 * `align`; numeric columns should align `end` and set `numeric` for tabular figures.
 */
const Root = forwardRef<HTMLTableElement, TableProps>(function Table({ density = "md", stickyHeader = false, className, style, ...rest }, ref) {
  // className and style place the scroll container (a max-height makes the header sticky); the rest describes the table.
  return (
    <div className={cx("z-table", className)} style={style} data-density={density} data-sticky={stickyHeader || undefined}>
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
}

const Cell = forwardRef<HTMLTableCellElement, TableCellProps>(function TableCell({ align = "start", numeric, className, ...rest }, ref) {
  return <td ref={ref} className={cx("z-table__cell", className)} data-align={align} data-numeric={numeric || undefined} {...rest} />;
});

export interface TableHeadCellProps extends Omit<ThHTMLAttributes<HTMLTableCellElement>, "align"> {
  align?: TableAlign;
  numeric?: boolean;
}

const HeadCell = forwardRef<HTMLTableCellElement, TableHeadCellProps>(function TableHeadCell({ align = "start", numeric, className, scope = "col", ...rest }, ref) {
  return <th ref={ref} className={cx("z-table__cell z-table__cell--head", className)} data-align={align} data-numeric={numeric || undefined} scope={scope} {...rest} />;
});

export const Table = Object.assign(Root, { Head, Body, Foot, Row, Cell, HeadCell });
