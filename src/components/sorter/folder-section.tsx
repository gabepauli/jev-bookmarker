"use client";

import { BookmarkRow } from "@/components/sorter/bookmark-row";
import type { ItemState, ParsedBookmark, TargetFolder } from "@/lib/sorter/types";

/** One target folder and the bookmarks currently in it. */
export function FolderSection({
  id,
  name,
  description,
  bookmarks,
  items,
  folders,
  threshold,
  onAssign,
  onRetry,
  needsLook,
}: {
  id: string;
  name: string;
  description?: string;
  bookmarks: ParsedBookmark[];
  items: Record<string, ItemState>;
  folders: TargetFolder[];
  threshold: number;
  onAssign: (id: string, folderId: string) => void;
  onRetry: (id: string) => void;
  needsLook: (item: ItemState | undefined, threshold: number) => boolean;
}) {
  return (
    <section
      id={`folder-${id}`}
      aria-labelledby={`folder-${id}-heading`}
      className="section-defer scroll-mt-4 overflow-hidden rounded-xl border border-border bg-surface"
    >
      <header className="px-4 py-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id={`folder-${id}-heading`} className="text-sm font-medium text-balance">
            {name}
          </h2>
          <span className="text-xs text-muted tabular-nums">
            {bookmarks.length} {bookmarks.length === 1 ? "bookmark" : "bookmarks"}
          </span>
        </div>
        {description && (
          <p className="mt-1 max-w-prose text-xs text-muted text-pretty">{description}</p>
        )}
      </header>

      <ul>
        {bookmarks.map((bookmark) => {
          const item = items[bookmark.id];
          return (
            <BookmarkRow
              key={bookmark.id}
              bookmark={bookmark}
              item={item}
              folders={folders}
              currentFolder={item?.assignedFolder ?? item?.suggestion?.folderId}
              needsLook={needsLook(item, threshold)}
              onAssign={onAssign}
              onRetry={onRetry}
            />
          );
        })}
      </ul>
    </section>
  );
}
