"use client";

import { Dialog, ScrollArea } from "radix-ui";

import { cn } from "@/lib/cn";
import type { SourceFolder } from "@/lib/sorter/types";

/**
 * Which folder to sort.
 *
 * A browser export is the whole bookmark bar — a thousand links across dozens of folders — and
 * almost nobody wants all of it reorganised at once. Sorting is scoped to one subtree, shown here
 * with its real link counts so the choice is obvious.
 */
export function SourceFolderDialog({
  open,
  folders,
  totalLinks,
  onPick,
  onCancel,
}: {
  open: boolean;
  folders: SourceFolder[];
  totalLinks: number;
  onPick: (folder: SourceFolder) => void;
  onCancel: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-overlay bg-black/50 motion-safe:animate-[--animate-overlay-in]" />
        <Dialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-dialog w-[min(32rem,calc(100vw-2rem))]",
            "-translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface shadow-xl",
            "motion-safe:animate-[--animate-content-in]",
          )}
        >
          <div className="px-5 pt-5">
            <Dialog.Title className="text-lg font-medium text-balance">
              Which folder should Jev sort?
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted text-pretty">
              Found {totalLinks.toLocaleString()} bookmarks. Pick one folder — its subfolders come
              along, and everything else in the file is left alone.
            </Dialog.Description>
          </div>

          <ScrollArea.Root className="mt-4 h-80 overflow-hidden">
            <ScrollArea.Viewport className="h-full w-full px-2">
              <ul className="pb-2">
                {folders.map((folder) => (
                  <li key={folder.key}>
                    <button
                      type="button"
                      onClick={() => onPick(folder)}
                      className="flex w-full items-center justify-between gap-4 rounded-md px-3 py-2 text-left hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{folder.label}</span>
                        {folder.path.length > 1 && (
                          <span className="block truncate text-xs text-muted">
                            {folder.path.slice(0, -1).join(" / ")}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-muted tabular-nums">
                        {folder.totalLinks}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar
              orientation="vertical"
              className="flex w-2 touch-none p-0.5 select-none"
            >
              <ScrollArea.Thumb className="flex-1 rounded-full bg-border" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>

          <div className="flex justify-end border-t border-border px-5 py-3">
            <Dialog.Close className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              Cancel
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
