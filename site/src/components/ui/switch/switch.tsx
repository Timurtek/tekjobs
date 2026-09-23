/* zengin-owned Switch, forked from @zenginui/ui@0.2.3, sha d7cb7f7418b9 */
import * as RadixSwitch from "@radix-ui/react-switch";
import { forwardRef, useId, type ReactNode } from "react";
import { cx } from "@/lib/cx";

export type SwitchSize = "sm" | "md";

export interface SwitchProps extends Omit<RadixSwitch.SwitchProps, "asChild" | "children"> {
  /** Visible label, rendered as a real `<label>` for the control. */
  label?: ReactNode;
  description?: ReactNode;
  size?: SwitchSize;
}

/** An on/off control with its label and description. Use a Checkbox when the change waits for a submit; a Switch takes effect at once. */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { label, description, size = "md", className, id: idProp, disabled, ...rest },
  ref,
) {
  const generated = useId();
  const id = idProp ?? generated;
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <div className={cx("z-switch", className)} data-size={size} data-disabled={disabled || undefined}>
      <span className="z-switch__box">
        <RadixSwitch.Root ref={ref} id={id} className="z-switch__control z-focusable" disabled={disabled} aria-describedby={descriptionId} {...rest}>
          <RadixSwitch.Thumb className="z-switch__thumb" />
        </RadixSwitch.Root>
      </span>
      {(label || description) && (
        <div className="z-switch__text">
          {label && (
            <label className="z-switch__label" htmlFor={id}>
              {label}
            </label>
          )}
          {description && (
            <p id={descriptionId} className="z-switch__description">
              {description}
            </p>
          )}
        </div>
      )}
    </div>
  );
});
