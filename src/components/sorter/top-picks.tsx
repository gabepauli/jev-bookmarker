"use client";

import { percent } from "@/components/format";
import { cn } from "@/lib/cn";
import { folderName } from "@/lib/sorter/taxonomy";
import type { FolderOdds, TargetFolder } from "@/lib/sorter/types";

/**
 * The runners-up, when the classifier was not sure.
 *
 * These are the fastest way to fix a wrong placement: the right answer is usually the second or
 * third option, one click away, rather than something to hunt for in a sixteen-item menu.
 */
export function TopPicks({
  distribution,
  folders,
  current,
  onPick,
}: {
  distribution: FolderOdds[];
  folders: TargetFolder[];
  current: string | undefined;
  onPick: (folderId: string) => void;
}) {
  const picks = distribution.slice(0, 3);
  if (picks.length < 2) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2" data-no-drag>
      <span className="text-xs text-muted">Top picks:</span>
      {picks.map((pick) => {
        const isCurrent = pick.folderId === current;
        return (
          <button
            key={pick.folderId}
            type="button"
            onClick={() => onPick(pick.folderId)}
            aria-pressed={isCurrent}
            className={cn(
              "rounded border px-2.5 py-1 text-xs transition-colors",
              "hover:border-muted hover:text-foreground",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              isCurrent
                ? "border-muted text-foreground"
                : "border-border text-muted",
            )}
          >
            {folderName(folders, pick.folderId)}
            {/* Real space rather than a word gap: the name and the odds are two facts, and
                dimming the number instead would put 12px text under the contrast floor. */}
            <span className="ms-2 tabular-nums">{percent(pick.p)}</span>
          </button>
        );
      })}
    </div>
  );
}
