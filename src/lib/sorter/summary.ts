import { folderCounts, needsLook, UNSORTED_ID } from "@/lib/sorter/session";
import type { SortSession } from "@/lib/sorter/types";

/**
 * The sentence under the page title.
 *
 * Kept pure and out of the component so the wording can be read and changed in one place — it is
 * the first thing the user reads after a sort, and it is doing a lot of work: what happened, what
 * still wants attention, and what was thrown away.
 */

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Up to two names, then "and N more" — a list of 40 titles is not a sentence. */
function nameList(titles: string[], limit = 2): string {
  if (titles.length === 0) return "";
  if (titles.length <= limit) return titles.join(", ");
  return `${titles.slice(0, limit).join(", ")} and ${titles.length - limit} more`;
}

export type SummaryParts = {
  headline: string;
  sentences: string[];
};

export function summaryParts(session: SortSession): SummaryParts {
  const { bookmarks, items, threshold, duplicates } = session;

  const counts = folderCounts(bookmarks, items, threshold);
  const filled = [...counts.entries()].filter(
    ([folderId, count]) => folderId !== UNSORTED_ID && count.total > 0,
  ).length;

  const classified = bookmarks.filter((bookmark) => items[bookmark.id]?.suggestion).length;
  const flagged = bookmarks.filter((bookmark) => needsLook(items[bookmark.id], threshold)).length;
  const portuguese = bookmarks.filter((bookmark) => bookmark.isPortuguese).length;
  const failed = bookmarks.filter((bookmark) => items[bookmark.id]?.error).length;

  const who = session.mode === "sample" ? "The sample sorter" : "Jev";

  const headline =
    classified === 0
      ? `${plural(bookmarks.length, "bookmark", "bookmarks")} ready to sort.`
      : `${who} sorted ${plural(classified, "bookmark", "bookmarks")} into ${plural(filled, "folder", "folders")}.`;

  const sentences: string[] = [];

  if (flagged > 0) {
    sentences.push(
      `${flagged} need${flagged === 1 ? "s" : ""} a look from you.`,
    );
  }
  if (portuguese > 0) {
    sentences.push(`${portuguese} ${portuguese === 1 ? "is" : "are"} in Portuguese.`);
  }
  if (failed > 0) {
    sentences.push(`${plural(failed, "bookmark", "bookmarks")} could not be sorted.`);
  }
  if (duplicates.length > 0) {
    // Naming them matters: URL normalisation can in principle merge two distinct pages, and a
    // silent merge is the kind of thing you only notice months later.
    sentences.push(
      `Removed ${plural(duplicates.length, "duplicate", "duplicates")} (${nameList(
        duplicates.map((duplicate) => duplicate.title),
      )}).`,
    );
  }

  return { headline, sentences };
}

/** The whole thing as one string, for a title attribute or a test. */
export function buildSummarySentence(session: SortSession): string {
  const { headline, sentences } = summaryParts(session);
  return [headline, ...sentences].join(" ");
}
