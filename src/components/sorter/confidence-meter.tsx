"use client";

import { Progress, Tooltip } from "radix-ui";

import { percent } from "@/components/format";
import { cn } from "@/lib/cn";

/**
 * How sure the classifier was.
 *
 * `confidence` is optional on purpose: a choice answer's probability distribution is optional
 * too, and when it is missing there is no honest number to show. Showing "—" and saying why
 * beats inventing a percentage.
 */
export function ConfidenceMeter({
  confidence,
  belowThreshold,
}: {
  confidence?: number;
  belowThreshold: boolean;
}) {
  if (confidence === undefined) {
    return (
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span className="cursor-default text-xs text-muted">— sure</span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            className="z-tooltip max-w-64 rounded-md bg-foreground px-2.5 py-1.5 text-xs leading-relaxed text-pretty text-background shadow-lg"
          >
            Jev picked this folder but returned no probability distribution, so there is no
            confidence to report.
            <Tooltip.Arrow className="fill-foreground" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "text-xs tabular-nums",
          belowThreshold ? "text-warn" : "text-muted",
        )}
      >
        {percent(confidence)} sure
      </span>
      <Progress.Root
        value={confidence * 100}
        className="relative h-1 w-14 overflow-hidden rounded-full bg-border"
      >
        <Progress.Indicator
          className={cn(
            "h-full rounded-full",
            belowThreshold ? "bg-warn" : "bg-muted",
          )}
          style={{ transform: `translateX(-${100 - confidence * 100}%)` }}
        />
      </Progress.Root>
    </div>
  );
}
