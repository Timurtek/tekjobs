/* zengin-owned Separator, forked from @zenginui/ui@0.2.3, sha c91249d2d96c */
import * as RadixSeparator from "@radix-ui/react-separator";
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cx } from "@/lib/cx";

export type SeparatorOrientation = "horizontal" | "vertical";

export interface SeparatorProps extends Omit<ComponentPropsWithoutRef<typeof RadixSeparator.Root>, "orientation" | "children"> {
  orientation?: SeparatorOrientation;
  /** Text set into the line, e.g. "or". Horizontal only. */
  label?: ReactNode;
}

/** A rule between groups. Decorative by default; pass `decorative={false}` when it separates landmarks. */
export const Separator = forwardRef<HTMLDivElement, SeparatorProps>(function Separator({ orientation = "horizontal", label, decorative = true, className, ...rest }, ref) {
  if (label && orientation === "horizontal") {
    return (
      <div className={cx("z-separator z-separator--labelled", className)} data-orientation={orientation} role={decorative ? undefined : "separator"}>
        <RadixSeparator.Root ref={ref} className="z-separator__line" decorative {...rest} />
        <span className="z-separator__label">{label}</span>
        <RadixSeparator.Root className="z-separator__line" decorative />
      </div>
    );
  }
  return <RadixSeparator.Root ref={ref} className={cx("z-separator", className)} orientation={orientation} decorative={decorative} {...rest} />;
});
