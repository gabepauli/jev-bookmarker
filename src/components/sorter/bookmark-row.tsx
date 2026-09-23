"use client";

import { memo, useCallback } from "react";
import { Select, Tooltip } from "radix-ui";

import { folderTrail, hostname } from "@/components/format";
import { Confidence } from "@/components/sorter/confidence";
import { DRAG_MIME } from "@/components/sorter/drag";
import { TopPicks } from "@/components/sorter/top-picks";
import { cn } from "@/lib/cn";
import type { ItemState, ParsedBookmark, TargetFolder } from "@/lib/sorter/types";

/**
 * One bookmark.
 *
 * Rendered a few hundred times, so it is memoized and every handler it receives has to be stable
 * — `onAssign` takes the id rather than being a per-row closure, which is what lets the parent
 * pass one function down to every row.
 */

export type BookmarkRowProps = {
  bookmark: ParsedBookmark;
  item: ItemState | undefined;
  folders: TargetFolder[];
  currentFolder: string | undefined;
  needsLook: boolean;
  onAssign: (id: string, folderId: string) => void;
  onRetry: (id: string) => void;
};

function BookmarkRowImpl({
  bookmark,
  item,
  folders,
  currentFolder,
  needsLook,
  onAssign,
  onRetry,
}: BookmarkRowProps) {
  const handleDragStart = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      // Starting a drag from the Move menu or a chip would swallow the click they exist for.
      if ((event.target as HTMLElement).closest("[data-no-drag]")) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.setData(DRAG_MIME, bookmark.id);
      event.dataTransfer.effectAllowed = "move";
    },
    [bookmark.id],
  );

  const handleSelect = useCallback(
    (folderId: string) => onAssign(bookmark.id, folderId),
    [bookmark.id, onAssign],
  );

  const handlePick = useCallback(
    (folderId: string) => onAssign(bookmark.id, folderId),
    [bookmark.id, onAssign],
  );

  const suggestion = item?.suggestion;
  const overridden = item?.assignedFolder !== undefined;

  return (
    <li
      draggable
      onDragStart={handleDragStart}
      className={cn(
        "group grid gap-x-6 gap-y-3 border-t border-border py-4",
        "grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto]",
        // A rule in the margin rather than a filled row. At a high threshold well over half the
        // list is flagged, and a fill turns the whole page orange; a 2px edge still scans in bulk.
        needsLook ? "border-l-2 border-l-accent pl-3" : "pl-[calc(0.75rem+2px)]",
      )}
    >
      <div className="min-w-0">
        <a
          href={bookmark.url}
          target="_blank"
          rel="noreferrer"
          data-no-drag
          className={cn(
            "block truncate text-sm text-foreground underline-offset-4 hover:underline",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          )}
        >
          {bookmark.title}
        </a>

        <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="truncate">{hostname(bookmark.url)}</span>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <span className="cursor-default truncate">
                Was in {folderTrail(bookmark.originalFolder)}
              </span>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                sideOffset={6}
                className="z-tooltip max-w-72 rounded-md bg-foreground px-2.5 py-1.5 text-xs text-pretty text-background shadow-lg"
              >
                Was in {bookmark.originalFolder}
                <Tooltip.Arrow className="fill-foreground" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
          {bookmark.isPortuguese && (
            <span className="rounded border border-border px-1 py-px text-[10px] font-medium tracking-wide">
              PT
            </span>
          )}
          {overridden && <span className="text-foreground">Moved by you</span>}
        </p>

        {item?.error && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-accent text-pretty">
            {item.error}
            <button
              type="button"
              data-no-drag
              onClick={() => onRetry(bookmark.id)}
              className="rounded border border-border px-1.5 py-0.5 text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Retry
            </button>
          </p>
        )}

        {needsLook && suggestion?.distribution && !overridden && (
          <div className="mt-3">
            <TopPicks
              distribution={suggestion.distribution}
              folders={folders}
              current={currentFolder}
              onPick={handlePick}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 justify-self-start sm:flex-col sm:items-end sm:justify-self-end sm:gap-2">
        {suggestion && !overridden && (
          <Confidence confidence={suggestion.confidence} belowThreshold={needsLook} />
        )}
        <MoveSelect
          folders={folders}
          value={currentFolder}
          onChange={handleSelect}
          title={bookmark.title}
        />
      </div>
    </li>
  );
}

function MoveSelect({
  folders,
  value,
  onChange,
  title,
}: {
  folders: TargetFolder[];
  value: string | undefined;
  onChange: (folderId: string) => void;
  title: string;
}) {
  return (
    <span data-no-drag>
      <Select.Root value={value ?? ""} onValueChange={onChange}>
        {/*
          Borderless until you reach for it. A bordered control repeated on every row is the
          loudest thing in a list of a few hundred, and the row is already obviously interactive.
          The outline comes back on hover and focus, so it is never hidden from the keyboard.
        */}
        <Select.Trigger
          aria-label={`Move “${title}” to a folder`}
          className={cn(
            "inline-flex items-center gap-1.5 rounded border border-transparent px-2 py-1 text-xs text-muted",
            "hover:border-border hover:text-foreground",
            "data-[state=open]:border-border data-[state=open]:text-foreground",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          )}
        >
          <span aria-hidden>In:</span>
          <span className="max-w-40 truncate">
            <Select.Value placeholder="nothing yet" />
          </span>
          <Select.Icon aria-hidden>▾</Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={4}
            className="z-dropdown max-h-72 overflow-hidden rounded-md border border-border bg-surface shadow-lg"
          >
            <Select.Viewport className="p-1">
              {folders.map((folder) => (
                <Select.Item
                  key={folder.id}
                  value={folder.id}
                  className="cursor-default rounded px-2 py-1.5 text-xs outline-none select-none data-[highlighted]:bg-border/60"
                >
                  <Select.ItemText>{folder.name}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </span>
  );
}

export const BookmarkRow = memo(BookmarkRowImpl);
