"use client";

import { useTransition } from "react";
import { DropdownMenu } from "radix-ui";

import { deleteBookmarkAction, reclassifyBookmarkAction } from "@/app/actions";
import { hostname, relativeTime } from "@/components/format";
import { JevVerdict } from "@/components/jev-verdict";
import type { Bookmark } from "@/lib/types";

export function BookmarkCard({ bookmark }: { bookmark: Bookmark }) {
  const [pending, startTransition] = useTransition();

  return (
    <li
      className={`rounded-md border border-border p-4 transition-opacity ${
        pending ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <a
            href={bookmark.url}
            target="_blank"
            rel="noreferrer noopener"
            className="block truncate font-medium hover:text-accent hover:underline"
          >
            {bookmark.title}
          </a>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            <span className="truncate font-mono">{hostname(bookmark.url)}</span>
            <span aria-hidden>·</span>
            <span>{relativeTime(bookmark.createdAt)}</span>
          </p>
        </div>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            aria-label={`Actions for ${bookmark.title}`}
            className="rounded-md px-2 py-1 text-muted transition-colors hover:bg-border/50 hover:text-foreground"
          >
            ⋯
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              className="z-50 min-w-44 rounded-lg border border-border bg-surface p-1 shadow-lg"
            >
              <DropdownMenu.Item
                onSelect={() =>
                  startTransition(async () => {
                    await reclassifyBookmarkAction(bookmark.id);
                  })
                }
                className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm outline-none data-[highlighted]:bg-border/60"
              >
                Re-run Jev
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                onSelect={() =>
                  startTransition(async () => {
                    await deleteBookmarkAction(bookmark.id);
                  })
                }
                className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-red-600 outline-none data-[highlighted]:bg-red-500/10 dark:text-red-400"
              >
                Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {bookmark.excerpt ? (
        <p className="mt-2 line-clamp-2 text-sm text-muted">{bookmark.excerpt}</p>
      ) : null}

      <div className="mt-3">
        {bookmark.classification ? (
          <JevVerdict classification={bookmark.classification} />
        ) : (
          <p className="text-xs text-muted">
            <span className="rounded-full bg-border/60 px-2 py-0.5">Unclassified</span>
            {bookmark.classificationError ? (
              <span className="ml-2">{bookmark.classificationError}</span>
            ) : null}
          </p>
        )}
      </div>
    </li>
  );
}
