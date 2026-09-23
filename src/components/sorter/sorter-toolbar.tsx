"use client";

import { ToggleGroup } from "radix-ui";

import { cn } from "@/lib/cn";
import type { SorterTab } from "@/lib/sorter/types";

export function SorterToolbar({
  tab,
  onTabChange,
  totalCount,
  needsLookCount,
  onExport,
  onEditFolders,
  canExport,
}: {
  tab: SorterTab;
  onTabChange: (tab: SorterTab) => void;
  totalCount: number;
  needsLookCount: number;
  onExport: () => void;
  onEditFolders: () => void;
  canExport: boolean;
}) {
  return (
    // Two groups under justify-between rather than one long row with ml-auto: when the row wraps,
    // the actions move as a block instead of leaving a hole where the middle used to be. No card
    // around it — a single rule underneath separates it from the list.
    <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-b border-border pb-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        {/*
          A ToggleGroup rather than Tabs: these filter the page itself, so there is no tab panel
          to point at, and Radix Tabs would emit an aria-controls referencing an element that
          does not exist. Arrow-key navigation is the same either way.
        */}
        <ToggleGroup.Root
          type="single"
          value={tab}
          onValueChange={(value) => value && onTabChange(value as SorterTab)}
          aria-label="Filter bookmarks"
          className="inline-flex rounded-md border border-border p-0.5"
        >
          <FilterButton value="all" label="All" count={totalCount} />
          <FilterButton value="needs-look" label="Needs a look" count={needsLookCount} />
        </ToggleGroup.Root>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onEditFolders}
          className="rounded-md border border-border px-3 py-1.5 text-sm whitespace-nowrap hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Edit folders
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={!canExport}
          // A disabled control has to say why, or it reads as broken.
          aria-describedby={canExport ? undefined : "export-disabled"}
          className={cn(
            "rounded-md bg-primary px-3 py-1.5 text-sm font-medium whitespace-nowrap text-primary-foreground",
            "hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          Export bookmarks file
        </button>
        {!canExport && (
          <span id="export-disabled" className="sr-only">
            Available once sorting finishes.
          </span>
        )}
      </div>
    </div>
  );
}

function FilterButton({
  value,
  label,
  count,
}: {
  value: SorterTab;
  label: string;
  count: number;
}) {
  return (
    <ToggleGroup.Item
      value={value}
      className={cn(
        "group flex items-center gap-1.5 rounded px-3 py-1 text-sm whitespace-nowrap text-muted",
        "data-[state=on]:bg-border/60 data-[state=on]:text-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
      )}
    >
      {label}
      {/* The count is a secondary detail, so it reads as one rather than as part of the name. */}
      <span className="text-xs tabular-nums opacity-60">{count}</span>
    </ToggleGroup.Item>
  );
}
