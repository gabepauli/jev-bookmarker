import { DEFAULT_FOLDERS, FALLBACK_FOLDER_ID, taxonomyHash } from "@/lib/sorter/taxonomy";
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
    sourceLabel: "",
    sourceKey: "",
    createdAt: new Date().toISOString(),
    bookmarks: [],
    items: {},
    folders,
    taxonomyHash: taxonomyHash(folders),
    duplicates: [],
    threshold: DEFAULT_THRESHOLD,
    portugueseMode: "mix",
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
      return action.session;

    case "session/cleared":
      return initialSession();

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
      };
    }

    case "status/changed":
      return { ...state, status: action.status };

    case "classify/started":
      return {
        ...state,
        status: "classifying",
        progress: { done: 0, total: action.total, failed: 0 },
      };

    case "classify/resolved": {
      const items = { ...state.items };
      let done = state.progress.done;
      let failed = state.progress.failed;

      for (const result of action.results) {
        const previous = items[result.id];
        if (!previous) continue;
        done += 1;
        if (result.ok) {
          items[result.id] = { ...previous, suggestion: result.suggestion, error: undefined };
        } else {
          failed += 1;
          items[result.id] = { ...previous, error: result.error };
        }
      }

      return {
        ...state,
        items,
        mode: action.mode,
        // The taxonomy these suggestions were produced against, so an edit can expire them.
        taxonomyHash: taxonomyHash(state.folders),
        progress: { ...state.progress, done, failed },
      };
    }

    case "classify/finished":
      return { ...state, status: "ready" };

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

    case "portuguese/changed":
      return { ...state, portugueseMode: action.mode };

    case "tab/changed":
      return { ...state, tab: action.tab };

    case "folders/changed": {
      // A deleted folder cannot keep holding bookmarks. Manual placements move to the fallback
      // rather than silently vanishing; suggestions pointing at it are dropped so the row
      // returns to unsorted and can be re-asked.
      const live = new Set(action.folders.map((folder) => folder.id));
      const fallback = live.has(FALLBACK_FOLDER_ID)
        ? FALLBACK_FOLDER_ID
        : action.folders[action.folders.length - 1]?.id;

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
