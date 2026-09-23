/* zengin-owned Card, forked from @zenginui/ui@0.2.3, sha a64b516f3b74 */
import { forwardRef, type HTMLAttributes } from "react";
import { cx } from "@/lib/cx";

export type CardVariant = "outlined" | "elevated" | "sunken";
export type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  /** Hover and focus treatment for cards that act as a single control. Make the card focusable and give it a role yourself. */
  interactive?: boolean;
}

const CardRoot = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = "outlined", padding = "md", interactive = false, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx("z-card", interactive && "z-focusable", className)}
      data-variant={variant}
      data-padding={padding}
      data-interactive={interactive || undefined}
      {...rest}
    />
  );
});

const Header = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function CardHeader({ className, ...rest }, ref) {
  return <div ref={ref} className={cx("z-card__header", className)} {...rest} />;
});

const Body = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function CardBody({ className, ...rest }, ref) {
  return <div ref={ref} className={cx("z-card__body", className)} {...rest} />;
});

const Footer = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function CardFooter({ className, ...rest }, ref) {
  return <div ref={ref} className={cx("z-card__footer", className)} {...rest} />;
});

export const Card = Object.assign(CardRoot, { Header, Body, Footer });
