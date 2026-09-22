/* zengin-owned EmptyState, forked from @zenginui/ui@0.2.0, sha 83e91806b273 */
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "@/lib/cx";

export type EmptyStateSize = "sm" | "md";
export type EmptyStateTone = "neutral" | "danger";

// `title` on an HTML element is the tooltip attribute, a string. This one is the heading, so the
// attribute is omitted rather than widened.
export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** What is not here. One line, in the user's words: "No customers yet", not "Empty collection". */
  title: ReactNode;
  /** Why, or what to do about it. One or two sentences. */
  description?: ReactNode;
  /** An icon above the title. Keep it quiet; this is not the moment for decoration. */
  icon?: ReactNode;
  /** The one action that resolves this state, if there is one. */
  action?: ReactNode;
  /** `sm` for a state inside a card or a column; `md` for a whole page. */
  size?: EmptyStateSize;
  /** `danger` for a state caused by a failure rather than by there being nothing yet. */
  tone?: EmptyStateTone;
}

/**
 * The screen when there is nothing to show. Every list, table and search has one, and it is usually written
 * last and worst, so it ships here: a filtered list with no matches, a queue that is finally clear, and a
 * table before its first row are three different messages, and the component makes room for saying so.
 */
export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(function EmptyState(
  { title, description, icon, action, size = "md", tone = "neutral", className, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={cx("z-empty", className)} data-size={size} data-tone={tone} {...rest}>
      {icon && (
        <span className="z-empty__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <p className="z-empty__title">{title}</p>
      {description && <p className="z-empty__description">{description}</p>}
      {action && <div className="z-empty__action">{action}</div>}
    </div>
  );
});
