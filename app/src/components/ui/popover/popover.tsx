/* zengin-owned Popover, forked from @zenginui/ui@0.1.0, sha 541b313bda00 */
import * as RadixPopover from "@radix-ui/react-popover";
import { createContext, forwardRef, useContext, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from "react";
import { cx } from "@/lib/cx";

export type PopoverSize = "sm" | "md" | "lg";

export interface PopoverProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Width of the panel. Padding scales with it. */
  size?: PopoverSize;
  /** Modal popovers trap focus and block the page. Default false. */
  modal?: boolean;
  children?: ReactNode;
}

const SizeContext = createContext<PopoverSize>("md");

/**
 * A small panel anchored to its trigger: a filter form, a date picker, a confirmation. For a menu of
 * actions use Menu; for a hint use Tooltip. Parts: Trigger, Anchor, Content, Close.
 */
function Root({ size = "md", children, ...rest }: PopoverProps) {
  return (
    <SizeContext.Provider value={size}>
      <RadixPopover.Root {...rest}>{children}</RadixPopover.Root>
    </SizeContext.Provider>
  );
}

const Trigger = RadixPopover.Trigger;
const Anchor = RadixPopover.Anchor;
const Close = RadixPopover.Close;

export interface PopoverContentProps extends ComponentPropsWithoutRef<typeof RadixPopover.Content> {
  /** Draw the arrow pointing at the trigger. Default true. */
  showArrow?: boolean;
}

const Content = forwardRef<ElementRef<typeof RadixPopover.Content>, PopoverContentProps>(function PopoverContent(
  { className, children, showArrow = true, sideOffset = 6, collisionPadding = 8, ...rest },
  ref,
) {
  const size = useContext(SizeContext);
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content ref={ref} className={cx("z-popover", className)} data-size={size} sideOffset={sideOffset} collisionPadding={collisionPadding} {...rest}>
        {children}
        {showArrow && <RadixPopover.Arrow className="z-popover__arrow" width={12} height={6} />}
      </RadixPopover.Content>
    </RadixPopover.Portal>
  );
});

export const Popover = Object.assign(Root, { Trigger, Anchor, Content, Close });
