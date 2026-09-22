/* zengin-owned Skeleton, forked from @zenginui/ui@0.1.0, sha d828eaf96706 */
import { forwardRef, type HTMLAttributes } from "react";
import { cx } from "@/lib/cx";

export type SkeletonVariant = "text" | "rect" | "circle";

export interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
  /** `text` is line-shaped and follows the font size; `rect` and `circle` take `width` and `height`. */
  variant?: SkeletonVariant;
  /** CSS length. `rect` and `circle` default to 100% wide; `text` to 100%. */
  width?: string;
  /** CSS length. `text` follows the line height; `rect` defaults to 4rem; `circle` to its width. */
  height?: string;
  /** For `text`: how many lines. The last one is shorter, as a paragraph would be. */
  lines?: number;
}

/** A placeholder in the shape of the content that is loading. Hidden from assistive tech; announce loading on the region instead. */
export const Skeleton = forwardRef<HTMLSpanElement, SkeletonProps>(function Skeleton({ variant = "text", width, height, lines = 1, className, style, ...rest }, ref) {
  if (variant === "text" && lines > 1) {
    return (
      <span ref={ref} className={cx("z-skeleton-lines", className)} aria-hidden="true" style={style} {...rest}>
        {Array.from({ length: lines }, (_, i) => (
          <span key={i} className="z-skeleton" data-variant="text" style={{ width: i === lines - 1 ? "60%" : width }} />
        ))}
      </span>
    );
  }
  return <span ref={ref} className={cx("z-skeleton", className)} data-variant={variant} aria-hidden="true" style={{ width, height, ...style }} {...rest} />;
});
