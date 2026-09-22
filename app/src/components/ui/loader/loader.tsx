/* zengin-owned Loader, forked from @zenginui/ui@0.1.0, sha 3401052c5d86 */
import { forwardRef, type HTMLAttributes } from "react";
import { cx } from "@/lib/cx";

export type LoaderSize = "sm" | "md";

export interface LoaderProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** Read to assistive tech and shown beside the dots when `showLabel`. Default "Thinking". */
  label?: string;
  showLabel?: boolean;
  size?: LoaderSize;
}

/** Three dots for the moment between a question and the first token. */
export const Loader = forwardRef<HTMLSpanElement, LoaderProps>(function Loader({ label = "Thinking", showLabel = false, size = "md", className, ...rest }, ref) {
  return (
    <span ref={ref} className={cx("z-loader", className)} data-size={size} role="status" aria-label={label} {...rest}>
      <span className="z-loader__dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {showLabel && <span className="z-loader__label">{label}</span>}
    </span>
  );
});
