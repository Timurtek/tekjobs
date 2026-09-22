/* zengin-owned Select, forked from @zenginui/ui@0.1.0, sha e9dcd0a21b30 */
import * as RadixSelect from "@radix-ui/react-select";
import { forwardRef, useId, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Icon } from "@/lib/icons";

export type SelectSize = "sm" | "md" | "lg";

export interface SelectProps extends Omit<ComponentPropsWithoutRef<typeof RadixSelect.Root>, "children"> {
  /** Visible label, rendered as a real `<label>` for the trigger. */
  label?: ReactNode;
  description?: ReactNode;
  /** Error message. Its presence marks the field invalid. */
  error?: ReactNode;
  placeholder?: ReactNode;
  size?: SelectSize;
  id?: string;
  className?: string;
  /** `Select.Item`, `Select.Group`, `Select.Label`, `Select.Separator`. */
  children?: ReactNode;
}

/**
 * A single-value select with its label, description and error, in the shape of TextField. Options are
 * `Select.Item`s; `Select.Group` and `Select.Label` section them. Keyboard: type to jump, arrows to move.
 */
const Root = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { label, description, error, placeholder = "Select", size = "md", id: idProp, className, children, disabled, required, ...rest },
  ref,
) {
  const generated = useId();
  const id = idProp ?? generated;
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const invalid = Boolean(error);

  return (
    <div className={cx("z-select", className)} data-size={size} data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
      {label && (
        <label className="z-select__label" htmlFor={id}>
          {label}
          {required && <span className="z-select__required" aria-hidden="true"> *</span>}
        </label>
      )}
      <RadixSelect.Root disabled={disabled} required={required} {...rest}>
        <RadixSelect.Trigger
          ref={ref}
          id={id}
          className="z-select__trigger z-focusable"
          aria-invalid={invalid || undefined}
          aria-describedby={[descriptionId, errorId].filter(Boolean).join(" ") || undefined}
        >
          <span className="z-select__value">
            <RadixSelect.Value placeholder={placeholder} />
          </span>
          <RadixSelect.Icon className="z-select__chevron" aria-hidden="true">
            <Icon.ChevronDown />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>
        <RadixSelect.Portal>
          <RadixSelect.Content className="z-select__content" position="popper" sideOffset={4} collisionPadding={8} data-size={size}>
            <RadixSelect.ScrollUpButton className="z-select__scroll" aria-hidden="true">
              <Chevron up />
            </RadixSelect.ScrollUpButton>
            <RadixSelect.Viewport className="z-select__viewport">{children}</RadixSelect.Viewport>
            <RadixSelect.ScrollDownButton className="z-select__scroll" aria-hidden="true">
              <Chevron />
            </RadixSelect.ScrollDownButton>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
      {description && (
        <p id={descriptionId} className="z-select__description">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} className="z-select__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});

function Chevron({ up = false }: { up?: boolean }) {
  return (
    up ? <Icon.ChevronUp /> : <Icon.ChevronDown />
  );
}

export type SelectItemProps = ComponentPropsWithoutRef<typeof RadixSelect.Item>;

const Item = forwardRef<ElementRef<typeof RadixSelect.Item>, SelectItemProps>(function SelectItem({ className, children, ...rest }, ref) {
  return (
    <RadixSelect.Item ref={ref} className={cx("z-select__item", className)} {...rest}>
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator className="z-select__indicator" aria-hidden="true">
        <Icon.Check strokeWidth={2} />
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  );
});

const Group = forwardRef<ElementRef<typeof RadixSelect.Group>, ComponentPropsWithoutRef<typeof RadixSelect.Group>>(function SelectGroup({ className, ...rest }, ref) {
  return <RadixSelect.Group ref={ref} className={cx("z-select__group", className)} {...rest} />;
});

const Label = forwardRef<ElementRef<typeof RadixSelect.Label>, ComponentPropsWithoutRef<typeof RadixSelect.Label>>(function SelectLabel({ className, ...rest }, ref) {
  return <RadixSelect.Label ref={ref} className={cx("z-select__group-label", className)} {...rest} />;
});

const Separator = forwardRef<ElementRef<typeof RadixSelect.Separator>, ComponentPropsWithoutRef<typeof RadixSelect.Separator>>(function SelectSeparator({ className, ...rest }, ref) {
  return <RadixSelect.Separator ref={ref} className={cx("z-select__separator", className)} {...rest} />;
});

export const Select = Object.assign(Root, { Item, Group, Label, Separator });
