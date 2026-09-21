"use client";

import { Select, Slider, ToggleGroup } from "radix-ui";

import { cn } from "@/lib/cn";
import type { PortugueseMode, SorterTab } from "@/lib/sorter/types";

const PORTUGUESE_OPTIONS: { value: PortugueseMode; label: string }[] = [
  { value: "mix", label: "Mix into topic folders" },
  { value: "group", label: "Keep in one folder" },
];

export function SorterToolbar({
  tab,
  onTabChange,
  totalCount,
  needsLookCount,
  threshold,
  onThresholdChange,
  portugueseMode,
  onPortugueseChange,
  portugueseCount,
  onExport,
  onEditFolders,
  canExport,
}: {
  tab: SorterTab;
  onTabChange: (tab: SorterTab) => void;
  totalCount: number;
  needsLookCount: number;
  threshold: number;
  onThresholdChange: (value: number) => void;
  portugueseMode: PortugueseMode;
  onPortugueseChange: (mode: PortugueseMode) => void;
  portugueseCount: number;
  onExport: () => void;
  onEditFolders: () => void;
  canExport: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-xl border border-border bg-surface p-4">
      {/*
        A ToggleGroup rather than Tabs: these filter the page itself, so there is no tab panel
        to point at, and Radix Tabs would emit an aria-controls referencing an element that does
        not exist. Arrow-key navigation is the same either way.
      */}
      <ToggleGroup.Root
        type="single"
        value={tab}
        onValueChange={(value) => value && onTabChange(value as SorterTab)}
        aria-label="Filter bookmarks"
        className="inline-flex rounded-lg bg-border/50 p-0.5"
      >
        <FilterButton value="all" label={`All (${totalCount})`} />
        <FilterButton value="needs-look" label={`Needs a look (${needsLookCount})`} />
      </ToggleGroup.Root>

      <div className="flex items-center gap-3">
        <span id="threshold-label" className="text-sm text-muted">
          Ask me when Jev is under
        </span>
        <Slider.Root
          value={[Math.round(threshold * 100)]}
          onValueChange={([value]) => onThresholdChange(value / 100)}
          min={0}
          max={100}
          step={5}
          className="relative flex h-5 w-36 touch-none items-center select-none"
        >
          <Slider.Track className="relative h-1 grow rounded-full bg-border">
            <Slider.Range className="absolute h-full rounded-full bg-accent" />
          </Slider.Track>
          <Slider.Thumb
            aria-labelledby="threshold-label"
            // Without this a screen reader announces a bare "60".
            aria-valuetext={`${Math.round(threshold * 100)} percent`}
            className="block size-4 rounded-full border border-border bg-surface shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </Slider.Root>
        <span className="w-10 text-sm tabular-nums">{Math.round(threshold * 100)}%</span>
      </div>

      {portugueseCount > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">Portuguese bookmarks</span>
          <Select.Root
            value={portugueseMode}
            onValueChange={(value) => onPortugueseChange(value as PortugueseMode)}
          >
            <Select.Trigger
              aria-label="What to do with Portuguese bookmarks on export"
              className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Select.Value />
              <Select.Icon aria-hidden>▾</Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content
                position="popper"
                sideOffset={4}
                className="z-dropdown overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
              >
                <Select.Viewport className="p-1">
                  {PORTUGUESE_OPTIONS.map((option) => (
                    <Select.Item
                      key={option.value}
                      value={option.value}
                      className="cursor-default rounded px-2 py-1.5 text-sm outline-none select-none data-[highlighted]:bg-border/60"
                    >
                      <Select.ItemText>{option.label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onEditFolders}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
            "rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white",
            "hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            "disabled:cursor-not-allowed disabled:opacity-50",
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

function FilterButton({ value, label }: { value: SorterTab; label: string }) {
  return (
    <ToggleGroup.Item
      value={value}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm text-muted",
        "data-[state=on]:bg-surface data-[state=on]:text-foreground data-[state=on]:shadow-sm",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
      )}
    >
      {label}
    </ToggleGroup.Item>
  );
}
