"use client";

import { useState } from "react";

import { isBookmarkDrag, readBookmarkId } from "@/components/sorter/drag";
import { cn } from "@/lib/cn";
import type { FolderCount } from "@/lib/sorter/session";
import { UNSORTED_ID } from "@/lib/sorter/session";
import type { TargetFolder } from "@/lib/sorter/types";

/**
 * The folder list, doubling as drop targets.
 *
 * Each row is a button so it works from the keyboard: clicking jumps to that section, which is
 * the only way to navigate a few hundred rows without scrolling past everything.
 */
export function FolderSidebar({
  folders,
  counts,
  unsortedCount,
  onDropBookmark,
}: {
  folders: TargetFolder[];
  counts: Map<string, FolderCount>;
  unsortedCount: number;
  onDropBookmark: (bookmarkId: string, folderId: string) => void;
}) {
  const [over, setOver] = useState<string | undefined>(undefined);

  return (
    <nav aria-label="Folders" className="sm:sticky sm:top-4 sm:self-start">
      <ul className="space-y-px">
        {folders.map((folder) => {
          const count = counts.get(folder.id) ?? { total: 0, needsLook: 0 };
          return (
            <li key={folder.id}>
              <button
                type="button"
                onClick={() => scrollToFolder(folder.id)}
                onDragOver={(event) => {
                  // Without preventDefault the browser never fires a drop here.
                  if (!isBookmarkDrag(event.dataTransfer)) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setOver(folder.id);
                }}
                onDragLeave={() => setOver((id) => (id === folder.id ? undefined : id))}
                onDrop={(event) => {
                  event.preventDefault();
                  setOver(undefined);
                  const id = readBookmarkId(event.dataTransfer);
                  if (id) onDropBookmark(id, folder.id);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-md px-3 py-1.5 text-left text-sm",
                  "hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  over === folder.id && "bg-border/60 ring-1 ring-accent",
                )}
              >
                <span className="truncate">{folder.name}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {count.needsLook > 0 && (
                    <>
                      {/* aria-label on a bare span is ignored, so the text is real and hidden. */}
                      <span aria-hidden className="size-1.5 rounded-full bg-warn" />
                      <span className="sr-only">
                        , {count.needsLook} needing a look
                      </span>
                    </>
                  )}
                  <span className="text-xs text-muted tabular-nums">{count.total}</span>
                </span>
              </button>
            </li>
          );
        })}

        {unsortedCount > 0 && (
          <li>
            <button
              type="button"
              onClick={() => scrollToFolder(UNSORTED_ID)}
              className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-1.5 text-left text-sm text-muted hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span className="truncate">Not sorted yet</span>
              <span className="text-xs tabular-nums">{unsortedCount}</span>
            </button>
          </li>
        )}
      </ul>

      <p className="mt-4 px-3 text-xs text-muted text-pretty">
        Drag a bookmark onto a folder here, or use its Move menu.
      </p>
    </nav>
  );
}

function scrollToFolder(id: string): void {
  document
    .getElementById(`folder-${id}`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}
