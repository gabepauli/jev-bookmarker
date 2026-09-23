/**
 * Shared vocabulary for the bulk sorter.
 *
 * Every type here crosses the server/client boundary — the client reducer holds them and the
 * `classifyBatchAction` server action takes and returns them. A `"use server"` file may only
 * export async functions, so these must live outside `src/app/sort-actions.ts`. Nothing in this
 * module may import `server-only` code.
 */

/** A folder path from the document root, outermost first. */
export type FolderPath = readonly string[];

/** One `<A>` from a Netscape bookmark file, after parsing. Frozen once imported. */
export type ParsedBookmark = {
  /** Stable, assigned in document order. */
  id: string;
  /** Exactly as written in HREF. */
  url: string;
  /** Dedupe key and classification cache key. */
  normalizedUrl: string;
  title: string;
  /** Raw ADD_DATE seconds, preserved verbatim for the export. Absent when the source had none. */
  addDate?: string;
  /** Full path from the document root. */
  path: FolderPath;
  /**
   * Path below the chosen subtree root, joined with " / ". Shown as "Was in …" on the row, and
   * scored by the local stand-in. Deliberately *not* sent to Jev — see `classifyPlacement`.
   */
  originalFolder: string;
  isPortuguese: boolean;
};

/** A target folder Jev sorts into. Editable in the UI, so none of this is compile-time known. */
export type TargetFolder = {
  /** Slug. Stable across renames so the classification cache survives an edit. */
  id: string;
  name: string;
  /** The text Jev reads. Changing it invalidates cached suggestions. */
  description: string;
  /** "Mostly comes from" — a display hint for the taxonomy editor. Never sent to Jev. */
  drawsFrom?: string[];
};

export type FolderOdds = { folderId: string; p: number };

export type FolderSuggestion = {
  /** Always validated against the live taxonomy before it lands here. */
  folderId: string;
  /** probabilities[choice]. Undefined when Jev returned no distribution — render "—", not NaN%. */
  confidence?: number;
  /** Sorted descending. Undefined when no distribution came back. Drives the top-picks chips. */
  distribution?: FolderOdds[];
  source: "jev" | "sample";
  /** The concrete model version the gateway resolved to. Only set for `source: "jev"`. */
  modelId?: string;
};

/**
 * What the classifier sees. Deliberately no page excerpt — see `sample-classifier.ts`.
 *
 * `originalFolder` looks unused now that Jev no longer reads it, but the local stand-in weights
 * it above the title, so removing it would gut sample mode. It travels; only `classifyPlacement`
 * declines to pass it on.
 */
export type ClassifyRequestItem = {
  id: string;
  url: string;
  title: string;
  originalFolder: string;
};

export type ClassifyResultItem =
  /**
   * `ms` is how long the classifier took on this one item, set only when a call was actually
   * made. A cache hit and the local stand-in both leave it undefined, which is what keeps them
   * out of the average without any separate bookkeeping.
   */
  | { id: string; ok: true; suggestion: FolderSuggestion; ms?: number }
  | { id: string; ok: false; error: string };

export type ClassifyBatchResult = {
  mode: "jev" | "sample";
  results: ClassifyResultItem[];
};

export type DuplicateRecord = {
  /** The id of the bookmark that was kept. */
  keptId: string;
  url: string;
  title: string;
};

/** A folder in the imported file, offered in the source picker. */
export type SourceFolder = {
  key: string;
  path: FolderPath;
  label: string;
  depth: number;
  /** Links directly inside this folder. */
  directLinks: number;
  /** Links including every descendant — what the picker shows. */
  totalLinks: number;
};

export type ImportResult = {
  bookmarks: ParsedBookmark[];
  folders: SourceFolder[];
  duplicates: DuplicateRecord[];
  totalParsed: number;
};

export type ItemState = {
  suggestion?: FolderSuggestion;
  /** User override. Undefined means "follow Jev". Never invalidated by a taxonomy edit. */
  assignedFolder?: string;
  error?: string;
};

/**
 * Timing for the most recent sorting run.
 *
 * Two different clocks, deliberately. `startedAt`/`finishedAt` are wall time — what you waited.
 * `totalMs` is the sum of per-item classifier latencies, which is several times larger because
 * `CONCURRENCY` items are in flight at once; divided by `timed` it answers "how long does Jev
 * take on one bookmark". Presenting either without the other is misleading.
 */
export type RunMetrics = {
  startedAt: number;
  /** Set when the run ends, whether it finished or was stopped. */
  finishedAt?: number;
  /** Items that went to the classifier this run. Cache hits are excluded. */
  timed: number;
  /** Sum of per-item latencies, ms. */
  totalMs: number;
};

export type SorterTab = "all" | "needs-look";
export type SorterStatus = "empty" | "parsing" | "picking" | "classifying" | "ready";
export type ClassifierMode = "jev" | "sample" | "unknown";

export type SortSession = {
  version: 1;
  /**
   * False until `localStorage` has been read after mount. Nothing renders from a session until
   * this is true, or the first paint would show an empty state that immediately replaces itself.
   * It lives in the session rather than beside it so restoring is a single dispatch.
   */
  hydrated: boolean;
  /** The chosen subtree's own name, e.g. "🧠 UX Links". */
  sourceLabel: string;
  sourceKey: string;
  createdAt: string;
  bookmarks: ParsedBookmark[];
  /** Keyed by `ParsedBookmark.id`. */
  items: Record<string, ItemState>;
  folders: TargetFolder[];
  /** Hash of every folder's name + description. A change marks suggestions stale. */
  taxonomyHash: string;
  duplicates: DuplicateRecord[];
  /** 0–1. Below this, a bookmark needs a look. */
  threshold: number;
  tab: SorterTab;
  status: SorterStatus;
  mode: ClassifierMode;
  progress: { done: number; total: number; failed: number };
  /** Absent until a run has happened. Optional so old saved sessions load without a version bump. */
  run?: RunMetrics;
};

export type SorterAction =
  /** Always dispatched once after mount; `session` is absent when storage held nothing. */
  | { type: "session/restored"; session?: SortSession }
  | { type: "session/imported"; result: ImportResult; source: SourceFolder }
  | { type: "session/cleared" }
  | { type: "status/changed"; status: SorterStatus }
  | { type: "classify/started"; total: number }
  | { type: "classify/resolved"; results: ClassifyResultItem[]; mode: ClassifierMode }
  | { type: "classify/finished" }
  | { type: "item/assigned"; id: string; folderId: string }
  | { type: "item/reset"; id: string }
  | { type: "threshold/changed"; value: number }
  | { type: "tab/changed"; tab: SorterTab }
  | { type: "folders/changed"; folders: TargetFolder[] };
