"use client";

import { useMemo, useState } from "react";
import { Select } from "radix-ui";

import { BookmarkCard } from "@/components/bookmark-card";
import { type Bookmark, CATEGORIES } from "@/lib/types";

const ALL = "all";
const UNCLASSIFIED = "unclassified";

export function BookmarkList({ bookmarks }: { bookmarks: Bookmark[] }) {
  const [filter, setFilter] = useState<string>(ALL);

  const visible = useMemo(() => {
    if (filter === ALL) return bookmarks;
    if (filter === UNCLASSIFIED) {
      return bookmarks.filter((bookmark) => !bookmark.classification);
    }
    return bookmarks.filter(
      (bookmark) => bookmark.classification?.category === filter,
    );
  }, [bookmarks, filter]);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium text-muted">
          {visible.length} {visible.length === 1 ? "bookmark" : "bookmarks"}
        </h2>

        <Select.Root value={filter} onValueChange={setFilter}>
          <Select.Trigger
            aria-label="Filter by category"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent/25"
          >
            <Select.Value />
            <Select.Icon>▾</Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content
              position="popper"
              sideOffset={4}
              className="z-50 overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
            >
              <Select.Viewport className="p-1">
                <SelectItem value={ALL}>All categories</SelectItem>
                {CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    <span className="capitalize">{category}</span>
                  </SelectItem>
                ))}
                <SelectItem value={UNCLASSIFIED}>Unclassified</SelectItem>
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>

      {visible.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">
          Nothing here yet. Add a bookmark to see what Jev makes of it.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visible.map((bookmark) => (
            <BookmarkCard key={bookmark.id} bookmark={bookmark} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SelectItem({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  return (
    <Select.Item
      value={value}
      className="cursor-pointer rounded-md px-3 py-1.5 pr-8 text-sm outline-none data-[highlighted]:bg-border/60"
    >
      <Select.ItemText>{children}</Select.ItemText>
    </Select.Item>
  );
}
