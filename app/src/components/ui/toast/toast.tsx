/* zengin-owned Toast, forked from @zenginui/ui@0.1.0, sha 21089953d994 */
import * as RadixToast from "@radix-ui/react-toast";
import { useEffect, useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Icon } from "@/lib/icons";

export type ToastTone = "neutral" | "success" | "warning" | "danger";
export type ToastPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left";

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  tone?: ToastTone;
  /** Milliseconds before it dismisses itself. Default 5000; `Infinity` keeps it until dismissed. */
  duration?: number;
  /** One action, e.g. Undo. Rendered as a button inside the toast. */
  action?: { label: string; onClick: () => void };
}

interface ToastRecord extends ToastOptions {
  id: number;
}

// A module-level store: `toast()` can be called from anywhere, and every mounted Provider renders the queue.
let nextId = 1;
let queue: ToastRecord[] = [];
const listeners = new Set<(items: ToastRecord[]) => void>();

function emit(): void {
  for (const l of listeners) l(queue);
}

/** Shows a toast. Returns its id, for `toast.dismiss`. */
export function toast(options: ToastOptions): number {
  const id = nextId++;
  queue = [...queue, { id, tone: "neutral", ...options }];
  emit();
  return id;
}

toast.dismiss = (id?: number): void => {
  queue = id === undefined ? [] : queue.filter((t) => t.id !== id);
  emit();
};

export interface ToastProviderProps {
  /** Corner of the viewport the toasts stack in. */
  position?: ToastPosition;
  /** Default duration for toasts that do not set one. */
  duration?: number;
  className?: string;
  children?: ReactNode;
}

/**
 * Mount one `Toast.Provider` near the root; call `toast({ title })` from anywhere. Toasts announce
 * politely, pause on hover, swipe to dismiss, and stack in the corner the provider chooses.
 */
function Provider({ position = "bottom-right", duration = 5000, className, children }: ToastProviderProps) {
  const [items, setItems] = useState<ToastRecord[]>(queue);
  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);
  const swipe = position.endsWith("right") ? "right" : "left";

  return (
    <RadixToast.Provider swipeDirection={swipe} duration={duration}>
      {children}
      {items.map((t) => (
        <RadixToast.Root
          key={t.id}
          className="z-toast"
          data-tone={t.tone}
          duration={t.duration}
          onOpenChange={(open) => {
            if (!open) toast.dismiss(t.id);
          }}
        >
          <div className="z-toast__body">
            <RadixToast.Title className="z-toast__title">{t.title}</RadixToast.Title>
            {t.description && <RadixToast.Description className="z-toast__description">{t.description}</RadixToast.Description>}
          </div>
          {t.action && (
            <RadixToast.Action className="z-toast__action z-focusable" altText={t.action.label} onClick={t.action.onClick}>
              {t.action.label}
            </RadixToast.Action>
          )}
          <RadixToast.Close className="z-toast__close z-focusable" aria-label="Dismiss">
            <Icon.Close />
          </RadixToast.Close>
        </RadixToast.Root>
      ))}
      <RadixToast.Viewport className={cx("z-toast__viewport", className)} data-position={position} label="Notifications" />
    </RadixToast.Provider>
  );
}

export const Toast = { Provider };
