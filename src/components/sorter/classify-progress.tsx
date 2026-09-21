"use client";

import { Progress } from "radix-ui";

export function ClassifyProgress({
  done,
  total,
  failed,
  onCancel,
}: {
  done: number;
  total: number;
  failed: number;
  onCancel: () => void;
}) {
  const fraction = total === 0 ? 0 : done / total;

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface px-4 py-3">
      <Progress.Root
        value={fraction * 100}
        className="relative h-1.5 w-48 overflow-hidden rounded-full bg-border"
      >
        <Progress.Indicator
          className="h-full rounded-full bg-accent transition-transform duration-200 ease-out"
          style={{ transform: `translateX(-${100 - fraction * 100}%)` }}
        />
      </Progress.Root>

      <p aria-live="polite" className="text-sm text-muted">
        <span className="tabular-nums">
          {done} of {total}
        </span>
        {failed > 0 && (
          <span className="text-warn"> · {failed} failed</span>
        )}
      </p>

      <button
        type="button"
        onClick={onCancel}
        className="ml-auto rounded-md border border-border px-3 py-1.5 text-sm hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Stop
      </button>
    </div>
  );
}
