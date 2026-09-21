"use client";

import { summaryParts } from "@/lib/sorter/summary";
import type { SortSession } from "@/lib/sorter/types";

export function SorterHeader({
  session,
  modelId,
  onStartOver,
}: {
  session: SortSession;
  modelId: string;
  onStartOver: () => void;
}) {
  const { headline, sentences } = summaryParts(session);

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-balance">
          Sort bookmarks: {session.sourceLabel}
        </h1>
        <p className="mt-2 max-w-prose text-sm text-muted text-pretty">
          {headline} {sentences.join(" ")}
        </p>

        {session.mode === "sample" && (
          <p className="mt-3 max-w-prose rounded-lg border border-warn/30 bg-warn-surface px-4 py-3 text-sm text-pretty">
            <strong className="font-medium">Sample results.</strong> The titles are yours, but the
            folders and percentages come from a local stand-in, not from Jev. Nothing has been sent
            anywhere. Set <code className="font-mono text-xs">AI_GATEWAY_API_KEY</code> and sort
            again to use{" "}
            <code className="font-mono text-xs">{modelId}</code> for real.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onStartOver}
        className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Import another file
      </button>
    </header>
  );
}
