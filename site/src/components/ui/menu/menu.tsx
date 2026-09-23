/* zengin-owned Menu, forked from @zenginui/ui@0.2.3, sha 873fd8f3c5a9 */
import * as RadixMenu from "@radix-ui/react-dropdown-menu";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Icon } from "@/lib/icons";

export type MenuItemTone = "neutral" | "danger";

export interface MenuProps extends ComponentPropsWithoutRef<typeof RadixMenu.Root> {}

/**
 * A dropdown menu of actions behind a trigger: row actions, the account menu, a "more" button.
 * Parts in the Radix shape: Trigger, Content, Item, CheckboxItem, RadioGroup, RadioItem, Label, Separator, Group.
 */
function Root(props: MenuProps) {
  return <RadixMenu.Root {...props} />;
}

const Trigger = RadixMenu.Trigger;
const Group = RadixMenu.Group;
const RadioGroup = RadixMenu.RadioGroup;

export interface MenuContentProps extends ComponentPropsWithoutRef<typeof RadixMenu.Content> {}

const Content = forwardRef<ElementRef<typeof RadixMenu.Content>, MenuContentProps>(function MenuContent({ className, sideOffset = 4, collisionPadding = 8, ...rest }, ref) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content ref={ref} className={cx("z-menu", className)} sideOffset={sideOffset} collisionPadding={collisionPadding} {...rest} />
    </RadixMenu.Portal>
  );
});

export interface MenuItemProps extends ComponentPropsWithoutRef<typeof RadixMenu.Item> {
  tone?: MenuItemTone;
  leadingIcon?: ReactNode;
  /** Keyboard hint shown at the right edge, e.g. "⌘K". Display only. */
  shortcut?: string;
}

const Item = forwardRef<ElementRef<typeof RadixMenu.Item>, MenuItemProps>(function MenuItem({ className, tone = "neutral", leadingIcon, shortcut, children, ...rest }, ref) {
  return (
    <RadixMenu.Item ref={ref} className={cx("z-menu__item", className)} data-tone={tone} {...rest}>
      {leadingIcon && <span className="z-icon z-menu__icon" aria-hidden="true">{leadingIcon}</span>}
      <span className="z-menu__text">{children}</span>
      {shortcut && <span className="z-menu__shortcut" aria-hidden="true">{shortcut}</span>}
    </RadixMenu.Item>
  );
});

const CheckboxItem = forwardRef<ElementRef<typeof RadixMenu.CheckboxItem>, ComponentPropsWithoutRef<typeof RadixMenu.CheckboxItem>>(function MenuCheckboxItem({ className, children, ...rest }, ref) {
  return (
    <RadixMenu.CheckboxItem ref={ref} className={cx("z-menu__item z-menu__item--check", className)} {...rest}>
      <RadixMenu.ItemIndicator className="z-menu__indicator" aria-hidden="true">
        <Icon.Check strokeWidth={2} />
      </RadixMenu.ItemIndicator>
      <span className="z-menu__text">{children}</span>
    </RadixMenu.CheckboxItem>
  );
});

const RadioItem = forwardRef<ElementRef<typeof RadixMenu.RadioItem>, ComponentPropsWithoutRef<typeof RadixMenu.RadioItem>>(function MenuRadioItem({ className, children, ...rest }, ref) {
  return (
    <RadixMenu.RadioItem ref={ref} className={cx("z-menu__item z-menu__item--check", className)} {...rest}>
      <RadixMenu.ItemIndicator className="z-menu__indicator" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="3" fill="currentColor" />
        </svg>
      </RadixMenu.ItemIndicator>
      <span className="z-menu__text">{children}</span>
    </RadixMenu.RadioItem>
  );
});

const Label = forwardRef<ElementRef<typeof RadixMenu.Label>, ComponentPropsWithoutRef<typeof RadixMenu.Label>>(function MenuLabel({ className, ...rest }, ref) {
  return <RadixMenu.Label ref={ref} className={cx("z-menu__label", className)} {...rest} />;
});

const Separator = forwardRef<ElementRef<typeof RadixMenu.Separator>, ComponentPropsWithoutRef<typeof RadixMenu.Separator>>(function MenuSeparator({ className, ...rest }, ref) {
  return <RadixMenu.Separator ref={ref} className={cx("z-menu__separator", className)} {...rest} />;
});

export const Menu = Object.assign(Root, { Trigger, Content, Item, CheckboxItem, RadioGroup, RadioItem, Label, Separator, Group });
