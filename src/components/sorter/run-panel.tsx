"use client";

import { useEffect, useState } from "react";
import { Progress, Slider, Tooltip } from "radix-ui";

import { duration } from "@/components/format";
import { cn } from "@/lib/cn";
import type { RunMetrics, SorterStatus } from "@/lib/sorter/types";

/**
 * What you steer the sort with: start it, stop it, see what it cost, and set how unsure Jev has
 * to be before it asks you.
 *
 * These live together because they are one loop — you sort, you read how it went, you move the
 * threshold, you sort the rest. The toolbar underneath is for looking at the result, which is a
 * different job. No card around it; a rule underneath, like every other band on this page.
 */
export function RunPanel({
  status,
  pendingCount,
  totalCount,
  progress,
  run,
  threshold,
  onThresholdChange,
  onStart,
  onStop,
}: {
  status: SorterStatus;
  /** Bookmarks with no placement yet. What Start has left to do. */
  pendingCount: number;
  totalCount: number;
  progress: { done: number; total: number; failed: number };
  run: RunMetrics | undefined;
  threshold: number;
  onThresholdChange: (value: number) => void;
  onStart: () => void;
  onStop: () => void;
}) {
  const percent = Math.round(threshold * 100);
  const classifying = status === "classifying";
  const elapsed = useElapsed(run, classifying);

  return (
    <section aria-label="Sorting" className="space-y-3 border-b border-border pb-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {/*
          One slot for the primary action, whatever it currently is. Rendering Start and Stop as
          separate elements that swap would move everything after them by the width of a word.
        */}
        {classifying ? (
          <button
            type="button"
            onClick={onStop}
            className="rounded-md border border-border px-3 py-1.5 text-sm whitespace-nowrap hover:bg-border/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={onStart}
            disabled={totalCount === 0}
            className={cn(
              pendingCount > 0
                ? "bg-primary font-medium text-primary-foreground hover:opacity-90"
                : "border border-border hover:bg-border/60",
              "rounded-md px-3 py-1.5 text-sm whitespace-nowrap",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            {pendingCount === 0
              ? "Sort again"
              : pendingCount === totalCount
                ? `Sort ${totalCount} bookmark${totalCount === 1 ? "" : "s"}`
                : `Sort the remaining ${pendingCount}`}
          </button>
        )}

        {classifying && (
          <Progress.Root
            aria-label="Sorting progress"
            value={progress.total === 0 ? 0 : (progress.done / progress.total) * 100}
            className="relative h-px w-48 overflow-hidden bg-border"
          >
            <Progress.Indicator
              className="h-full bg-foreground transition-transform duration-200 ease-out"
              style={{
                transform: `translateX(-${
                  100 - (progress.total === 0 ? 0 : (progress.done / progress.total) * 100)
                }%)`,
              }}
            />
          </Progress.Root>
        )}

        <p aria-live="polite" className="text-sm text-muted text-pretty">
          {classifying ? (
            <>
              <span className="tabular-nums">
                {progress.done} of {progress.total}
              </span>
              {progress.failed > 0 && (
                <span className="text-accent"> · {progress.failed} failed</span>
              )}
            </>
          ) : run === undefined ? (
            "Nothing has been sent anywhere yet."
          ) : pendingCount > 0 ? (
            `${pendingCount} still to sort.`
          ) : (
            "Everything is sorted."
          )}
        </p>

        {run && (
          <dl className="ml-auto flex items-baseline gap-x-5 text-xs text-muted">
            <Metric label="Elapsed" value={duration(elapsed)} />
            {run.timed > 0 && (
              <Metric
                label="Per bookmark"
                value={duration(run.totalMs / run.timed)}
                // The two numbers look like they disagree — eight bookmarks are in flight at
                // once, so the wall clock is a fraction of the work added up. Saying so is the
                // difference between a useful metric and one that reads as a bug.
                hint={`Average time Jev took to place one bookmark, across ${run.timed} of them. Several run at once, so the elapsed total is much shorter than these added together. Bookmarks answered from the local cache are not counted.`}
              />
            )}
          </dl>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span id="threshold-label" className="text-sm whitespace-nowrap text-muted">
            Ask me when Jev is under
          </span>
          <Slider.Root
            value={[percent]}
            onValueChange={([value]) => onThresholdChange(value / 100)}
            min={0}
            max={100}
            step={5}
            className="relative flex h-5 w-40 touch-none items-center select-none"
          >
            <Slider.Track className="relative h-px grow bg-border">
              <Slider.Range className="absolute h-full bg-foreground" />
            </Slider.Track>
            <Slider.Thumb
              aria-labelledby="threshold-label"
              aria-describedby="threshold-help"
              // Without this a screen reader announces a bare "60".
              aria-valuetext={`${percent} percent`}
              className="block size-3 rounded-full bg-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </Slider.Root>
          {/* Fixed width and tabular figures, or the row twitches as you drag. */}
          <span className="w-9 text-sm font-medium tabular-nums">{percent}%</span>
        </div>
        <p id="threshold-help" className="mt-1.5 max-w-prose text-xs text-muted text-pretty">
          Anything Jev is less sure about than this is flagged in the list and collected under
          Needs a look.
        </p>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  // tabIndex on the trigger because a <dt> is not focusable on its own, and Radix opens a
  // tooltip on focus as well as hover — without it the explanation is mouse-only.
  const term = (
    <dt
      className={cn(
        hint &&
          "cursor-default underline decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
      )}
      tabIndex={hint ? 0 : undefined}
    >
      {label}
    </dt>
  );

  return (
    <div className="flex items-baseline gap-x-1.5">
      {hint ? (
        <Tooltip.Root>
          <Tooltip.Trigger asChild>{term}</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              sideOffset={6}
              className="z-tooltip max-w-72 rounded-md bg-foreground px-2.5 py-1.5 text-xs leading-relaxed text-pretty text-background shadow-lg"
            >
              {hint}
              <Tooltip.Arrow className="fill-foreground" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      ) : (
        term
      )}
      <dd className="font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

/**
 * Wall time for the run, ticking once a second while it is live and frozen once it ends.
 *
 * A second is as fine as this needs to be — it is a sense of how long, not a stopwatch — and it
 * keeps the interval off the critical path of a run that is already re-rendering a few hundred
 * rows a batch at a time.
 */
function useElapsed(run: RunMetrics | undefined, classifying: boolean): number {
  // Zero until the interval first fires. Reading the clock while rendering is not allowed —
  // and would not help anyway, since a value captured at mount predates a run started later.
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!classifying) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [classifying]);

  if (!run) return 0;
  // A finished run is pure arithmetic; only a live one needs the ticking clock.
  if (run.finishedAt !== undefined) return run.finishedAt - run.startedAt;
  if (!classifying) return 0;
  // Clamped, so the first second of a run reads as 0s rather than as time before it began.
  return Math.max(0, now - run.startedAt);
}
