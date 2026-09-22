/* zengin-owned TextArea, forked from @zenginui/ui@0.2.0, sha 8899907ec106 */
import { forwardRef, useId, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

export type TextAreaSize = "sm" | "md" | "lg";
export type TextAreaResize = "none" | "vertical" | "both";

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Visible label. Required for accessibility; pass `aria-label` on the rare occasions a visible label is wrong. */
  label?: ReactNode;
  /** Help text under the control. */
  description?: ReactNode;
  /** Error message. Its presence marks the field invalid. */
  error?: ReactNode;
  size?: TextAreaSize;
  /** Which way the user may drag the corner. Default vertical. */
  resize?: TextAreaResize;
  /**
   * Render the value in the system's monospace face. For content that is code or data rather than prose: a
   * JSON block, an API key, a path. The face is the `font-mono` token, so it follows `zengin fonts`.
   */
  font?: "sans" | "mono";
}

/** A multi-line text field with its label, description and error, in the shape of TextField. */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, description, error, size = "md", resize = "vertical", font = "sans", rows = 3, className, id: idProp, disabled, readOnly, required, ...rest },
  ref,
) {
  const generated = useId();
  const id = idProp ?? generated;
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const invalid = Boolean(error);

  return (
    <div
      className={cx("z-textarea", className)}
      data-size={size}
      data-resize={resize}
      data-font={font}
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
    >
      {label && (
        <label className="z-textarea__label" htmlFor={id}>
          {label}
          {required && <span className="z-textarea__required" aria-hidden="true"> *</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        className="z-textarea__control z-focusable"
        rows={rows}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={[descriptionId, errorId].filter(Boolean).join(" ") || undefined}
        {...rest}
      />
      {description && (
        <p id={descriptionId} className="z-textarea__description">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} className="z-textarea__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
