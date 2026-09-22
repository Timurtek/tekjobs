/* zengin-owned Sheet, forked from @zenginui/ui@0.1.0, sha 3421fbc2a001 */
import * as RadixDialog from "@radix-ui/react-dialog";
import { createContext, forwardRef, useContext, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Icon } from "@/lib/icons";

export type SheetSide = "right" | "left" | "top" | "bottom";
export type SheetSize = "sm" | "md" | "lg";

export interface SheetProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Edge the panel slides in from. */
  side?: SheetSide;
  /** Width for left and right, height for top and bottom. */
  size?: SheetSize;
  /** Modal sheets trap focus and block the page. Default true. */
  modal?: boolean;
  children?: ReactNode;
}

const SheetContext = createContext<{ side: SheetSide; size: SheetSize }>({ side: "right", size: "md" });

/**
 * A panel that slides in from an edge: navigation on small screens, a detail view beside a table, a
 * filter drawer. Same parts as Dialog: Trigger, Content, Title, Description, Footer, Close.
 */
function Root({ side = "right", size = "md", children, ...rest }: SheetProps) {
  return (
    <SheetContext.Provider value={{ side, size }}>
      <RadixDialog.Root {...rest}>{children}</RadixDialog.Root>
    </SheetContext.Provider>
  );
}

const Trigger = RadixDialog.Trigger;
const Close = RadixDialog.Close;

export interface SheetContentProps extends ComponentPropsWithoutRef<typeof RadixDialog.Content> {
  /** Render a close button in the top corner. Default true. */
  showClose?: boolean;
}

const Content = forwardRef<ElementRef<typeof RadixDialog.Content>, SheetContentProps>(function SheetContent({ className, children, showClose = true, ...rest }, ref) {
  const { side, size } = useContext(SheetContext);
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="z-sheet__overlay" />
      <RadixDialog.Content ref={ref} className={cx("z-sheet", className)} data-side={side} data-size={size} {...rest}>
        {children}
        {showClose && (
          <RadixDialog.Close className="z-sheet__close z-focusable" aria-label="Close">
            <Icon.Close />
          </RadixDialog.Close>
        )}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
});

const Title = forwardRef<ElementRef<typeof RadixDialog.Title>, ComponentPropsWithoutRef<typeof RadixDialog.Title>>(function SheetTitle({ className, ...rest }, ref) {
  return <RadixDialog.Title ref={ref} className={cx("z-sheet__title", className)} {...rest} />;
});

const Description = forwardRef<ElementRef<typeof RadixDialog.Description>, ComponentPropsWithoutRef<typeof RadixDialog.Description>>(function SheetDescription({ className, ...rest }, ref) {
  return <RadixDialog.Description ref={ref} className={cx("z-sheet__description", className)} {...rest} />;
});

const Footer = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(function SheetFooter({ className, ...rest }, ref) {
  return <div ref={ref} className={cx("z-sheet__footer", className)} {...rest} />;
});

export const Sheet = Object.assign(Root, { Trigger, Content, Title, Description, Footer, Close });
