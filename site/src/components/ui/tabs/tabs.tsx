/* zengin-owned Tabs, forked from @zenginui/ui@0.2.3, sha 39258932cbaf */
import * as RadixTabs from "@radix-ui/react-tabs";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { cx } from "@/lib/cx";

export type TabsVariant = "line" | "pill";
export type TabsSize = "sm" | "md";

export interface TabsProps extends Omit<ComponentPropsWithoutRef<typeof RadixTabs.Root>, "orientation" | "dir" | "activationMode"> {
  /** `line` underlines the active tab; `pill` lifts it inside a sunken track. */
  variant?: TabsVariant;
  size?: TabsSize;
}

/**
 * Tabs switch between panels of related content. The root carries `variant` and `size`; List, Trigger
 * and Content are the parts, in the Radix shape. Keyboard: arrows move between tabs, Home/End jump.
 */
const Root = forwardRef<ElementRef<typeof RadixTabs.Root>, TabsProps>(function Tabs({ variant = "line", size = "md", className, ...rest }, ref) {
  return <RadixTabs.Root ref={ref} className={cx("z-tabs", className)} data-variant={variant} data-size={size} {...rest} />;
});

export type TabsListProps = ComponentPropsWithoutRef<typeof RadixTabs.List>;

const List = forwardRef<ElementRef<typeof RadixTabs.List>, TabsListProps>(function TabsList({ className, ...rest }, ref) {
  return <RadixTabs.List ref={ref} className={cx("z-tabs__list", className)} {...rest} />;
});

export type TabsTriggerProps = ComponentPropsWithoutRef<typeof RadixTabs.Trigger>;

const Trigger = forwardRef<ElementRef<typeof RadixTabs.Trigger>, TabsTriggerProps>(function TabsTrigger({ className, ...rest }, ref) {
  return <RadixTabs.Trigger ref={ref} className={cx("z-tabs__trigger z-focusable", className)} {...rest} />;
});

export type TabsContentProps = ComponentPropsWithoutRef<typeof RadixTabs.Content>;

const Content = forwardRef<ElementRef<typeof RadixTabs.Content>, TabsContentProps>(function TabsContent({ className, ...rest }, ref) {
  return <RadixTabs.Content ref={ref} className={cx("z-tabs__content z-focusable", className)} {...rest} />;
});

export const Tabs = Object.assign(Root, { List, Trigger, Content });
