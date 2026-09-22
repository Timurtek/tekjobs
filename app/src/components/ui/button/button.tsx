/* zengin-owned Button, forked from @zenginui/ui@0.1.0, sha 46be3b593d87 */
import { Slot, Slottable } from "@radix-ui/react-slot";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "@/lib/cx";

export type ButtonVariant = "solid" | "soft" | "ghost" | "link";
export type ButtonTone = "neutral" | "primary" | "danger";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonAlign = "center" | "start";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual weight. `solid` for the primary action in a group, `soft` for secondary, `ghost` for tertiary, `link` for inline. */
  variant?: ButtonVariant;
  /** Semantic color. `danger` for destructive actions only. */
  tone?: ButtonTone;
  size?: ButtonSize;
  /** Where the content sits. `start` for full-width buttons in a navigation column. */
  align?: ButtonAlign;
  /** Shows a spinner, disables interaction, and keeps the button's width so the layout does not jump. */
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  /** Render the child element instead of a button, passing the button's props and styling to it. For links styled as buttons. */
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "solid", tone = "neutral", size = "md", align = "center", loading = false, leadingIcon, trailingIcon, asChild = false, className, disabled, children, type, ...rest },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  const isDisabled = disabled || loading;
  return (
    <Comp
      ref={ref}
      className={cx("z-button z-focusable", className)}
      data-variant={variant}
      data-tone={tone}
      data-size={size}
      data-align={align}
      data-loading={loading || undefined}
      data-disabled={isDisabled || undefined}
      aria-busy={loading || undefined}
      aria-disabled={asChild && isDisabled ? true : undefined}
      disabled={asChild ? undefined : isDisabled}
      type={asChild ? undefined : (type ?? "button")}
      {...rest}
    >
      {loading && (
        <span className="z-button__spinner" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </span>
      )}
      {leadingIcon && !loading && <span className="z-icon z-button__icon" aria-hidden="true">{leadingIcon}</span>}
      <Slottable>{asChild ? children : <span className="z-button__label">{children}</span>}</Slottable>
      {trailingIcon && <span className="z-icon z-button__icon" aria-hidden="true">{trailingIcon}</span>}
    </Comp>
  );
});
