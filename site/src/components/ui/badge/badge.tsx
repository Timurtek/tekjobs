/* zengin-owned Badge, forked from @zenginui/ui@0.2.3, sha 5378bde7b1a2 */
import { forwardRef, type HTMLAttributes } from "react";
import { cx } from "@/lib/cx";

export type BadgeTone = "neutral" | "primary" | "danger" | "success" | "warning";
export type BadgeVariant = "soft" | "solid" | "outline";
export type BadgeSize = "sm" | "md";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Semantic color. Use `success`, `warning` and `danger` for status, `primary` for emphasis, `neutral` for labels. */
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { tone = "neutral", variant = "soft", size = "md", className, ...rest },
  ref,
) {
  return <span ref={ref} className={cx("z-badge", className)} data-tone={tone} data-variant={variant} data-size={size} {...rest} />;
});
