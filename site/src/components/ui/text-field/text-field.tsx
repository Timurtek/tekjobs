/* zengin-owned TextField, forked from @zenginui/ui@0.2.3, sha b4f1fa281b2d */
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "@/lib/cx";

export type TextFieldSize = "sm" | "md" | "lg";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Visible label. Required for accessibility; pass `aria-label` on the rare occasions a visible label is wrong. */
  label?: ReactNode;
  /** Help text under the input. */
  description?: ReactNode;
  /** Error message. Its presence marks the field invalid. */
  error?: ReactNode;
  size?: TextFieldSize;
  /**
   * Render the value in the system's monospace face. For content that is code or data rather than prose: a
   * JSON block, an API key, a path. The face is the `font-mono` token, so it follows `zengin fonts`.
   */
  font?: "sans" | "mono";
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, description, error, size = "md", font = "sans", leadingIcon, trailingIcon, className, id: idProp, disabled, readOnly, required, ...rest },
  ref,
) {
  const generated = useId();
  const id = idProp ?? generated;
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const invalid = Boolean(error);

  return (
    <div
      className={cx("z-field", className)}
      data-size={size}
      data-font={font}
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
    >
      {label && (
        <label className="z-field__label" htmlFor={id}>
          {label}
          {required && <span className="z-field__required" aria-hidden="true"> *</span>}
        </label>
      )}
      <div className="z-field__control">
        {leadingIcon && <span className="z-icon z-field__icon" aria-hidden="true">{leadingIcon}</span>}
        <input
          ref={ref}
          id={id}
          className="z-field__input z-focusable"
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={[descriptionId, errorId].filter(Boolean).join(" ") || undefined}
          {...rest}
        />
        {trailingIcon && <span className="z-icon z-field__icon" aria-hidden="true">{trailingIcon}</span>}
      </div>
      {description && (
        <p id={descriptionId} className="z-field__description">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} className="z-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
