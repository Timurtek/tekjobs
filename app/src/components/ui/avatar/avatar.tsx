/* zengin-owned Avatar, forked from @zenginui/ui@0.1.0, sha 8273c4170b2d */
import * as RadixAvatar from "@radix-ui/react-avatar";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cx } from "@/lib/cx";

export type AvatarSize = "sm" | "md" | "lg" | "xl";
export type AvatarShape = "circle" | "square";

export interface AvatarProps extends Omit<ComponentPropsWithoutRef<typeof RadixAvatar.Root>, "children"> {
  src?: string;
  /** The person's or thing's name. Used for the alt text and for the initials while the image loads or when there is none. */
  name: string;
  size?: AvatarSize;
  shape?: AvatarShape;
  /** Milliseconds to wait before showing initials, so a fast image does not flash them. Default 300. */
  delay?: number;
}

/** A picture of a person, a team or a workspace, with initials as the fallback. */
export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar({ src, name, size = "md", shape = "circle", delay = 300, className, ...rest }, ref) {
  return (
    <RadixAvatar.Root ref={ref} className={cx("z-avatar", className)} data-size={size} data-shape={shape} {...rest}>
      {src && <RadixAvatar.Image className="z-avatar__image" src={src} alt={name} />}
      <RadixAvatar.Fallback className="z-avatar__fallback" delayMs={src ? delay : undefined} aria-label={name} role="img">
        {initials(name)}
      </RadixAvatar.Fallback>
    </RadixAvatar.Root>
  );
});

/** First letters of the first and last words, so "Ada Lovelace" is AL and "Acme" is A. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = words[0]!.charAt(0);
  const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : "";
  return (first + last).toUpperCase();
}
