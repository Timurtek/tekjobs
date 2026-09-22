/* zengin-owned Progress, forked from @zenginui/ui@0.1.0, sha 18f49a95c714 */
import * as RadixProgress from "@radix-ui/react-progress";
import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cx } from "@/lib/cx";

export type ProgressSize = "sm" | "md";
export type ProgressTone = "primary" | "neutral" | "success" | "warning" | "danger";

export interface ProgressProps extends Omit<ComponentPropsWithoutRef<typeof RadixProgress.Root>, "value" | "max" | "children"> {
  /** 0 to `max`. Leave undefined for an indeterminate bar. */
  value?: number;
  max?: number;
  /** Visible label above the bar. */
  label?: ReactNode;
  /** Show the value as a percentage next to the label. */
  showValue?: boolean;
  size?: ProgressSize;
  tone?: ProgressTone;
}

/** A bar for quota, upload, or a task with an end. Indeterminate when no value is known. */
export const Progress = forwardRef<HTMLDivElement, ProgressProps>(function Progress(
  { value, max = 100, label, showValue = false, size = "md", tone = "primary", className, ...rest },
  ref,
) {
  const id = useId();
  const percent = value === undefined ? undefined : Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={cx("z-progress", className)} data-size={size} data-tone={tone}>
      {(label || showValue) && (
        <div className="z-progress__head">
          {label && (
            <span id={id} className="z-progress__label">
              {label}
            </span>
          )}
          {showValue && percent !== undefined && <span className="z-progress__value">{Math.round(percent)}%</span>}
        </div>
      )}
      <RadixProgress.Root ref={ref} className="z-progress__track" value={value ?? null} max={max} aria-labelledby={label ? id : undefined} {...rest}>
        <RadixProgress.Indicator className="z-progress__indicator" style={percent === undefined ? undefined : { transform: `translateX(-${100 - percent}%)` }} />
      </RadixProgress.Root>
    </div>
  );
});
