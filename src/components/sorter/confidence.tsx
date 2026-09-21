"use client";

import { Tooltip } from "radix-ui";

import { percent } from "@/components/format";
import { cn } from "@/lib/cn";

/**
 * How sure the classifier was.
 *
 * Just the number. This used to sit beside a small bar, but a bar thin enough not to shout reads
 * as a stray dash next to the figure it duplicates, and a bar thick enough to read is louder than
 * the row it annotates. The percentage is the information; orange is the judgement.
 *
 * `confidence` is optional on purpose: a choice answer's probability distribution is optional too,
 * and when it is missing there is no honest number to show.
 */
export function Confidence({
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
    <span
      className={cn(
        "text-xs tabular-nums",
        belowThreshold ? "text-accent" : "text-muted",
      )}
    >
      {percent(confidence)} sure
    </span>
  );
}
