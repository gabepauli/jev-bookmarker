import { DEFAULT_FOLDERS, fallbackFolderId, taxonomyHash } from "@/lib/sorter/taxonomy";
import type {
  ItemState,
  ParsedBookmark,
  SortSession,
  SorterAction,
  TargetFolder,
} from "@/lib/sorter/types";

export const DEFAULT_THRESHOLD = 0.6;

export function initialSession(): SortSession {
  const folders = [...DEFAULT_FOLDERS];
  return {
    version: 1,
    hydrated: false,
    sourceLabel: "",
    sourceKey: "",
    createdAt: new Date().toISOString(),
    bookmarks: [],
    items: {},
    folders,
    taxonomyHash: taxonomyHash(folders),
    duplicates: [],
    threshold: DEFAULT_THRESHOLD,
    tab: "all",
    status: "empty",
    mode: "unknown",
    progress: { done: 0, total: 0, failed: 0 },
  };
}

/** Where a bookmark actually sits: the user's choice if they made one, else Jev's. */
export function effectiveFolder(item: ItemState | undefined): string | undefined {
  return item?.assignedFolder ?? item?.suggestion?.folderId;
}

/**
 * Whether a bookmark is asking for the user's attention.
 *
 * An unknown confidence is deliberately *not* a flag. If Jev returns no distribution, every row
 * would light up amber and the signal would be worthless; those rows say so individually
 * instead. A bookmark the user has already placed by hand is never flagged — deciding is what
 * clears it.
 */
export function needsLook(item: ItemState | undefined, threshold: number): boolean {
  if (!item) return false;
  if (item.error) return true;
  if (item.assignedFolder) return false;
  const confidence = item.suggestion?.confidence;
  return confidence !== undefined && confidence < threshold;
}

/**
 * Bookmarks the classifier has not placed yet — what a Start button has left to do.
 *
 * An errored item counts: it still has no answer, and the whole point of resuming is to go back
 * for it. One the user placed by hand does not — deciding is what settles a bookmark, and
 * re-asking would overwrite them.
 */
export function unsortedBookmarks(
  bookmarks: ParsedBookmark[],
  items: Record<string, ItemState>,
): ParsedBookmark[] {
  return bookmarks.filter((bookmark) => {
    const item = items[bookmark.id];
    return !item?.suggestion && !item?.assignedFolder;
  });
}

/** Bookmarks per folder id, in the taxonomy's order, including folders that ended up empty. */
export function groupByFolder(
  bookmarks: ParsedBookmark[],
  items: Record<string, ItemState>,
  folders: TargetFolder[],
): Map<string, ParsedBookmark[]> {
  const groups = new Map<string, ParsedBookmark[]>();
  for (const folder of folders) groups.set(folder.id, []);
  groups.set(UNSORTED_ID, []);

  for (const bookmark of bookmarks) {
    const folderId = effectiveFolder(items[bookmark.id]) ?? UNSORTED_ID;
    (groups.get(folderId) ?? groups.get(UNSORTED_ID))!.push(bookmark);
  }
  return groups;
}

/** Holds bookmarks that have not been classified yet, or whose classification failed. */
export const UNSORTED_ID = "__unsorted";

export type FolderCount = { total: number; needsLook: number };

export function folderCounts(
  bookmarks: ParsedBookmark[],
  items: Record<string, ItemState>,
  threshold: number,
): Map<string, FolderCount> {
  const counts = new Map<string, FolderCount>();
  for (const bookmark of bookmarks) {
    const item = items[bookmark.id];
    const folderId = effectiveFolder(item) ?? UNSORTED_ID;
    const entry = counts.get(folderId) ?? { total: 0, needsLook: 0 };
    entry.total += 1;
    if (needsLook(item, threshold)) entry.needsLook += 1;
    counts.set(folderId, entry);
  }
  return counts;
}

/**
 * True when the suggestions on screen were produced against a different taxonomy than the one
 * now in force, so their folder ids and confidences no longer mean what they say.
 */
export function suggestionsAreStale(session: SortSession): boolean {
  return (
    session.taxonomyHash !== taxonomyHash(session.folders) &&
    Object.values(session.items).some((item) => item.suggestion)
  );
}

export function sorterReducer(state: SortSession, action: SorterAction): SortSession {
  switch (action.type) {
    case "session/restored":
      return { ...(action.session ?? state), hydrated: true };

    case "session/cleared":
      return { ...initialSession(), hydrated: true, folders: state.folders };

    case "session/imported": {
      const items: Record<string, ItemState> = {};
      for (const bookmark of action.result.bookmarks) items[bookmark.id] = {};
      return {
        ...state,
        sourceLabel: action.source.label,
        sourceKey: action.source.key,
        createdAt: new Date().toISOString(),
        bookmarks: action.result.bookmarks,
        items,
        duplicates: action.result.duplicates,
        status: "ready",
        mode: "unknown",
        tab: "all",
        progress: { done: 0, total: action.result.bookmarks.length, failed: 0 },
        // Last import's timing describes bookmarks that are no longer here.
        run: undefined,
      };
    }

    case "status/changed":
      return { ...state, status: action.status };

    case "classify/started":
      return {
        ...state,
        status: "classifying",
        progress: { done: 0, total: action.total, failed: 0 },
        run: { startedAt: Date.now(), timed: 0, totalMs: 0 },
      };

    case "classify/resolved": {
      const items = { ...state.items };
      let done = state.progress.done;
      let failed = state.progress.failed;
      let timed = state.run?.timed ?? 0;
      let totalMs = state.run?.totalMs ?? 0;

      for (const result of action.results) {
        const previous = items[result.id];
        if (!previous) continue;
        done += 1;
        if (result.ok) {
          items[result.id] = { ...previous, suggestion: result.suggestion, error: undefined };
          // Undefined for a cache hit and for the stand-in, which is exactly what keeps both out
          // of the average rather than reporting them as instant work.
          if (result.ms !== undefined) {
            timed += 1;
            totalMs += result.ms;
          }
        } else {
          failed += 1;
          items[result.id] = { ...previous, error: result.error };
        }
      }

      // A single-row retry resolves outside a run. It must still land its suggestion, but letting
      // it touch the counters would push `done` past `total` and restate a finished run's timing.
      const tracking = state.status === "classifying";

      return {
        ...state,
        items,
        mode: action.mode,
        // The taxonomy these suggestions were produced against, so an edit can expire them.
        taxonomyHash: taxonomyHash(state.folders),
        progress: tracking ? { ...state.progress, done, failed } : state.progress,
        run: tracking && state.run ? { ...state.run, timed, totalMs } : state.run,
      };
    }

    case "classify/finished":
      return {
        ...state,
        status: "ready",
        run: state.run ? { ...state.run, finishedAt: Date.now() } : undefined,
      };

    case "item/assigned": {
      const previous = state.items[action.id];
      if (!previous) return state;
      return {
        ...state,
        items: {
          ...state.items,
          [action.id]: { ...previous, assignedFolder: action.folderId },
        },
      };
    }

    case "item/reset": {
      const previous = state.items[action.id];
      if (!previous) return state;
      const { assignedFolder: _dropped, ...rest } = previous;
      void _dropped;
      return { ...state, items: { ...state.items, [action.id]: rest } };
    }

    case "threshold/changed":
      return { ...state, threshold: action.value };

    case "tab/changed":
      return { ...state, tab: action.tab };

    case "folders/changed": {
      // A deleted folder cannot keep holding bookmarks. Manual placements move to the fallback
      // rather than silently vanishing; suggestions pointing at it are dropped so the row
      // returns to unsorted and can be re-asked.
      const live = new Set(action.folders.map((folder) => folder.id));
      const fallback = fallbackFolderId(action.folders);

      const items: Record<string, ItemState> = {};
      for (const [id, item] of Object.entries(state.items)) {
        const next: ItemState = { ...item };
        if (next.assignedFolder && !live.has(next.assignedFolder)) {
          next.assignedFolder = fallback;
        }
        if (next.suggestion && !live.has(next.suggestion.folderId)) {
          next.suggestion = undefined;
        }
        items[id] = next;
      }

      return { ...state, folders: action.folders, items };
    }

    default:
      return state;
  }
}
