/* zengin-owned TabBar, added by TekJobs (not forked from @zenginui/ui) */
import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "@/lib/cx";

export interface TabBarProps extends HTMLAttributes<HTMLElement> {
  /** What the bar navigates, for screen readers: "Pages". */
  "aria-label": string;
}

export interface TabBarItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The icon above the label. Filled or outlined, but the same family as its neighbours. */
  icon: ReactNode;
  /** One short word. Tab bars label every item; an icon alone is not enough. */
  label: string;
  /** The page on screen. Marked with aria-current and a tinted background, not color alone. */
  current?: boolean;
}

/**
 * Navigation between top-level pages at phone width, along the bottom edge where a thumb reaches (Apple HIG).
 * At most five items, navigation only (never actions), always visible, and every item labelled. It clears the
 * home indicator by itself. Wider screens use a sidebar for the same destinations; render one or the other.
 */
const TabBarRoot = forwardRef<HTMLElement, TabBarProps>(function TabBar({ className, children, ...rest }, ref) {
  return (
    <nav ref={ref} className={cx("z-tabbar", className)} {...rest}>
      {children}
    </nav>
  );
});

const TabBarItem = forwardRef<HTMLButtonElement, TabBarItemProps>(function TabBarItem({ icon, label, current = false, className, type = "button", ...rest }, ref) {
  return (
    <button ref={ref} type={type} className={cx("z-tabbar__item z-focusable", className)} aria-current={current ? "page" : undefined} {...rest}>
      <span className="z-tabbar__icon" aria-hidden="true">{icon}</span>
      <span className="z-tabbar__label">{label}</span>
    </button>
  );
});

export const TabBar = Object.assign(TabBarRoot, { Item: TabBarItem });
