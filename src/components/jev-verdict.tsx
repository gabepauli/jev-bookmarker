"use client";

import { Progress, Tooltip } from "radix-ui";

import { isLongFormLabel } from "@/components/format";
import {
  type Classification,
  priorityFraction,
  priorityLabel,
} from "@/lib/types";

function Hint({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={6}
          className="z-50 max-w-64 rounded-md bg-foreground px-2.5 py-1.5 text-xs leading-relaxed text-background shadow-lg"
        >
          {label}
          <Tooltip.Arrow className="fill-foreground" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/**
 * Renders what Jev actually returned. The raw numbers sit behind tooltips rather than being
 * hidden, since the probability is the interesting part of a probabilistic verdict.
 */
export function JevVerdict({
  classification,
}: {
  classification: Classification;
}) {
  const { category, categoryConfidence, priorityScore, longFormProbability } =
    classification;
  const fraction = priorityFraction(priorityScore);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Hint
        label={
          categoryConfidence === undefined
            ? "Jev chose this category. No probability distribution was returned."
            : `Jev's confidence in "${category}": ${(categoryConfidence * 100).toFixed(1)}%`
        }
      >
        {/* One neutral chip rather than a hue per category: the label already names the
            category, and five unrelated colours were the loudest thing on the page. */}
        <span className="inline-flex cursor-default items-center rounded border border-border px-2 py-0.5 text-xs font-medium capitalize">
          {category}
        </span>
      </Hint>

      <Hint
        label={`Reading priority ${priorityScore.toFixed(2)} of 3 — "${priorityLabel(priorityScore)}". Jev returns a fractional position between the ordered levels, not a 0-1 value.`}
      >
        <div className="flex cursor-default items-center gap-2">
          <Progress.Root
            value={fraction * 100}
            className="relative h-1.5 w-20 overflow-hidden rounded-full bg-border"
          >
            <Progress.Indicator
              className="h-full rounded-full bg-foreground transition-transform"
              style={{ transform: `translateX(-${100 - fraction * 100}%)` }}
            />
          </Progress.Root>
          <span className="text-xs text-muted">{priorityLabel(priorityScore)}</span>
        </div>
      </Hint>

      <Hint
        label={`Jev estimates a ${(longFormProbability * 100).toFixed(1)}% chance this is long-form. That is P(true), not a confidence score — the app thresholds it at 50%.`}
      >
        <span className="cursor-default text-xs text-muted">
          {isLongFormLabel(longFormProbability)}
        </span>
      </Hint>
    </div>
  );
}
