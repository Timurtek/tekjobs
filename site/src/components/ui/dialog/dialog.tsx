/* zengin-owned Dialog, forked from @zenginui/ui@0.2.3, sha 89d8228f0092 */
import * as RadixDialog from "@radix-ui/react-dialog";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Icon } from "@/lib/icons";

export type DialogSize = "sm" | "md" | "lg";

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Width of the panel. Padding scales with it. */
  size?: DialogSize;
  /** Modal dialogs trap focus and block the page. Non-modal ones do not. Default true. */
  modal?: boolean;
  children?: ReactNode;
}

interface DialogContextValue {
  size: DialogSize;
}

// Size is decided on the root and read by Content, so consumers set it once.
import { createContext, useContext } from "react";
const SizeContext = createContext<DialogContextValue>({ size: "md" });

function DialogRoot({ size = "md", children, ...rest }: DialogProps) {
  return (
    <SizeContext.Provider value={{ size }}>
      <RadixDialog.Root {...rest}>{children}</RadixDialog.Root>
    </SizeContext.Provider>
  );
}

const Trigger = RadixDialog.Trigger;
const Close = RadixDialog.Close;

export interface DialogContentProps extends ComponentPropsWithoutRef<typeof RadixDialog.Content> {
  /** Render a close button in the top corner. Default true. */
  showClose?: boolean;
}

/** The panel. Wraps Portal and Overlay, so nothing else is needed. */
const Content = forwardRef<ElementRef<typeof RadixDialog.Content>, DialogContentProps>(function DialogContent(
  { className, children, showClose = true, ...rest },
  ref,
) {
  const { size } = useContext(SizeContext);
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="z-dialog__overlay" />
      <RadixDialog.Content ref={ref} className={cx("z-dialog", className)} data-size={size} {...rest}>
        {children}
        {showClose && (
          <RadixDialog.Close className="z-dialog__close z-focusable" aria-label="Close">
            <Icon.Close />
          </RadixDialog.Close>
        )}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
});

const Title = forwardRef<ElementRef<typeof RadixDialog.Title>, ComponentPropsWithoutRef<typeof RadixDialog.Title>>(
  function DialogTitle({ className, ...rest }, ref) {
    return <RadixDialog.Title ref={ref} className={cx("z-dialog__title", className)} {...rest} />;
  },
);

const Description = forwardRef<ElementRef<typeof RadixDialog.Description>, ComponentPropsWithoutRef<typeof RadixDialog.Description>>(
  function DialogDescription({ className, ...rest }, ref) {
    return <RadixDialog.Description ref={ref} className={cx("z-dialog__description", className)} {...rest} />;
  },
);

/** Action row at the bottom of the panel. */
const Footer = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(function DialogFooter({ className, ...rest }, ref) {
  return <div ref={ref} className={cx("z-dialog__footer", className)} {...rest} />;
});

export const Dialog = Object.assign(DialogRoot, { Trigger, Content, Title, Description, Footer, Close });
