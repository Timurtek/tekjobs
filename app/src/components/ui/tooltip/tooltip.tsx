/* zengin-owned Tooltip, forked from @zenginui/ui@0.1.0, sha 8cba4ad7613c */
import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactElement, ReactNode } from "react";

export type TooltipSide = "top" | "right" | "bottom" | "left";

export interface TooltipProps {
  /** The tooltip text. Keep it to a short phrase; tooltips are for names and hints, not paragraphs. */
  content: ReactNode;
  /** The element that triggers the tooltip. Must accept a ref and forward props: a Button, a link, an icon button. */
  children: ReactElement;
  side?: TooltipSide;
  /** Milliseconds before the tooltip opens on hover. Default 300. */
  delay?: number;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * A tooltip around one trigger. Wrap an app once in `Tooltip.Provider` so nearby tooltips skip the delay
 * when the pointer moves between them.
 */
function TooltipRoot({ content, children, side = "top", delay = 300, open, defaultOpen, onOpenChange }: TooltipProps) {
  return (
    <RadixTooltip.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} delayDuration={delay}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content className="z-tooltip" side={side} sideOffset={6} collisionPadding={8}>
          {content}
          <RadixTooltip.Arrow className="z-tooltip__arrow" width={10} height={5} />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

export const Tooltip = Object.assign(TooltipRoot, { Provider: RadixTooltip.Provider });
