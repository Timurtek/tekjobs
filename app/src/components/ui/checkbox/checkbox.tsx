/* zengin-owned Checkbox, forked from @zenginui/ui@0.1.0, sha 6192c35e2e09 */
import * as RadixCheckbox from "@radix-ui/react-checkbox";
import { forwardRef, useId, type ReactNode } from "react";
import { cx } from "@/lib/cx";

export type CheckboxSize = "sm" | "md";

export interface CheckboxProps extends Omit<RadixCheckbox.CheckboxProps, "asChild" | "children"> {
  /** Visible label, rendered as a real `<label>` for the control. */
  label?: ReactNode;
  description?: ReactNode;
  size?: CheckboxSize;
}

/** A checkbox with its label and description. Supports `checked="indeterminate"`. */
export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(function Checkbox(
  { label, description, size = "md", className, id: idProp, disabled, ...rest },
  ref,
) {
  const generated = useId();
  const id = idProp ?? generated;
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <div className={cx("z-checkbox", className)} data-size={size} data-disabled={disabled || undefined}>
      <span className="z-checkbox__box">
      <RadixCheckbox.Root
        ref={ref}
        id={id}
        className="z-checkbox__control z-focusable"
        disabled={disabled}
        aria-describedby={descriptionId}
        {...rest}
      >
        <RadixCheckbox.Indicator className="z-checkbox__indicator" forceMount>
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path className="z-checkbox__check" d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path className="z-checkbox__dash" d="M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      </span>
      {(label || description) && (
        <div className="z-checkbox__text">
          {label && (
            <label className="z-checkbox__label" htmlFor={id}>
              {label}
            </label>
          )}
          {description && (
            <p id={descriptionId} className="z-checkbox__description">
              {description}
            </p>
          )}
        </div>
      )}
    </div>
  );
});
