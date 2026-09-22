/* zengin-owned Combobox, forked from @zenginui/ui@0.2.2, sha 2de09510ecb0 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Badge } from "../badge/badge";
import { Icon } from "@/lib/icons";

export type ComboboxSize = "sm" | "md" | "lg";

export interface ComboboxOption {
  value: string;
  label: string;
  /** A second line under the label: an email, a description, an id. */
  hint?: string;
  disabled?: boolean;
  /** Options with the same group are drawn together under its name. */
  group?: string;
}

interface Base {
  options: ComboboxOption[];
  /** Visible label. Required, as everywhere else in the system. */
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  placeholder?: string;
  size?: ComboboxSize;
  disabled?: boolean;
  /** What to say when the typed text matches nothing. */
  emptyMessage?: string;
  className?: string;
  id?: string;
}

export interface ComboboxSingleProps extends Base {
  multiple?: false;
  value?: string | null;
  onValueChange?: (value: string | null) => void;
}

export interface ComboboxMultipleProps extends Base {
  multiple: true;
  value?: string[];
  onValueChange?: (value: string[]) => void;
}

export type ComboboxProps = ComboboxSingleProps | ComboboxMultipleProps;

/**
 * An option's DOM id, from its position in the list rather than from its value.
 *
 * `aria-activedescendant` is a single IDREF and an id may not contain whitespace, so building ids out of
 * values broke the moment a value was "Assembly AI": assistive technology reads nothing while the user
 * arrows through, and nothing looks wrong, because `getElementById` tolerates the space and the highlight is
 * drawn from an index. A position is always id-safe and always unique in the list being rendered.
 */
function optionId(base: string, index: number): string {
  return `${base}-option-${index}`;
}

/**
 * A text field that filters a list, for choosing one thing or several from more than a Select should hold.
 *
 * Select is right up to a few dozen options; past that the answer is typing, and typing needs a different
 * component rather than a bigger Select. This follows the WAI-ARIA combobox pattern properly, which is the
 * reason to have it in a system at all: the input keeps focus and owns the keyboard, the list is a real
 * listbox, and the active option is pointed at with `aria-activedescendant` rather than by moving focus into
 * the list. Hand-rolled comboboxes almost always get that last part wrong, and a screen reader then reads
 * nothing as the user arrows through.
 */
export function Combobox(props: ComboboxProps) {
  const {
    options,
    label,
    description,
    error,
    placeholder,
    size = "md",
    disabled,
    emptyMessage = "No matches",
    className,
    id: idProp,
  } = props;
  const multiple = props.multiple === true;

  const reactId = useId();
  const id = idProp ?? reactId;
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo<string[]>(() => {
    if (multiple) return (props as ComboboxMultipleProps).value ?? [];
    const single = (props as ComboboxSingleProps).value;
    return single ? [single] : [];
  }, [multiple, props]);

  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || (o.hint ?? "").toLowerCase().includes(q));
  }, [options, query, multiple]);

  // The active option is an index into what is currently shown, so it resets whenever the list changes.
  useEffect(() => setActive(0), [query, open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = (option: ComboboxOption) => {
    if (option.disabled) return;
    if (multiple) {
      const next = selected.includes(option.value) ? selected.filter((v) => v !== option.value) : [...selected, option.value];
      (props as ComboboxMultipleProps).onValueChange?.(next);
      setQuery("");
      inputRef.current?.focus();
      return;
    }
    (props as ComboboxSingleProps).onValueChange?.(option.value);
    setQuery("");
    setOpen(false);
  };

  const remove = (value: string) => {
    if (!multiple) return;
    (props as ComboboxMultipleProps).onValueChange?.(selected.filter((v) => v !== value));
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const key = event.key;
    if (key === "ArrowDown" || key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const step = key === "ArrowDown" ? 1 : -1;
      // Wraps, and steps over disabled options rather than stopping on one.
      for (let i = 1; i <= matches.length; i++) {
        const next = (active + step * i + matches.length * i) % matches.length;
        if (!matches[next]?.disabled) {
          setActive(next);
          return;
        }
      }
      return;
    }
    if (key === "Enter" && open) {
      const option = matches[active];
      if (option) {
        event.preventDefault();
        choose(option);
      }
      return;
    }
    if (key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
      return;
    }
    // Backspace on an empty field takes the last chip, which is what every tag input does.
    if (key === "Backspace" && multiple && query === "" && selected.length) {
      remove(selected[selected.length - 1]!);
    }
  };

  const groups = useMemo(() => {
    const out: { name: string | undefined; options: ComboboxOption[] }[] = [];
    for (const option of matches) {
      const last = out[out.length - 1];
      if (last && last.name === option.group) last.options.push(option);
      else out.push({ name: option.group, options: [option] });
    }
    return out;
  }, [matches]);

  let flat = -1;
  const describedBy = [description ? `${id}-description` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;

  return (
    <div ref={rootRef} className={cx("z-combobox", className)} data-size={size} data-invalid={error ? "" : undefined} data-disabled={disabled || undefined}>
      <label className="z-combobox__label" htmlFor={id}>
        {label}
      </label>

      <div className="z-combobox__control">
        {multiple &&
          selected.map((value) => (
            <Badge key={value} size="sm" tone="neutral" variant="soft" className="z-combobox__chip">
              {byValue.get(value)?.label ?? value}
              <button type="button" className="z-combobox__remove z-focusable" aria-label={`Remove ${byValue.get(value)?.label ?? value}`} onClick={() => remove(value)} disabled={disabled}>
                <Icon.Close size={12} />
              </button>
            </Badge>
          ))}

        <input
          ref={inputRef}
          id={id}
          className="z-combobox__input z-focusable"
          role="combobox"
          type="text"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? optionId(id, active) : undefined}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          disabled={disabled}
          placeholder={multiple || !selected.length ? placeholder : byValue.get(selected[0]!)?.label}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />

        <span className="z-combobox__chevron" aria-hidden="true">
          <Icon.ChevronDown size={16} />
        </span>
      </div>

      {open && (
        <ul ref={listRef} className="z-combobox__list" id={listId} role="listbox" aria-label={typeof label === "string" ? label : undefined} aria-multiselectable={multiple || undefined}>
          {groups.map((group, gi) => (
            <li key={group.name ?? `g${gi}`} className="z-combobox__group" role="presentation">
              {group.name && <p className="z-combobox__group-name">{group.name}</p>}
              <ul role="presentation">
                {group.options.map((option) => {
                  flat += 1;
                  const index = flat;
                  const isSelected = selected.includes(option.value);
                  return (
                    <li
                      key={option.value}
                      id={optionId(id, index)}
                      data-value={option.value}
                      className="z-combobox__option"
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={option.disabled || undefined}
                      data-active={index === active}
                      data-selected={isSelected || undefined}
                      // Pointer down, not click: a click would blur the input first and close the list.
                      onPointerDown={(e) => {
                        e.preventDefault();
                        choose(option);
                      }}
                      onPointerEnter={() => setActive(index)}
                    >
                      <span className="z-combobox__option-label">{option.label}</span>
                      {option.hint && <span className="z-combobox__option-hint">{option.hint}</span>}
                      {isSelected && (
                        <span className="z-combobox__tick" aria-hidden="true">
                          <Icon.Check size={14} />
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
          {matches.length === 0 && (
            <li className="z-combobox__empty" role="presentation">
              {emptyMessage}
            </li>
          )}
        </ul>
      )}

      {description && !error && (
        <p className="z-combobox__description" id={`${id}-description`}>
          {description}
        </p>
      )}
      {error && (
        <p className="z-combobox__error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
