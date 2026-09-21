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
  /** Path below the chosen subtree root, joined with " / ". Shown as "Was in …", sent to Jev. */
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

/** What the classifier sees. Deliberately no page excerpt — see `sample-classifier.ts`. */
export type ClassifyRequestItem = {
  id: string;
  url: string;
  title: string;
  originalFolder: string;
};

export type ClassifyResultItem =
  | { id: string; ok: true; suggestion: FolderSuggestion }
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

export type PortugueseMode = "mix" | "group";
export type SorterTab = "all" | "needs-look";
export type SorterStatus = "empty" | "parsing" | "picking" | "classifying" | "ready";
export type ClassifierMode = "jev" | "sample" | "unknown";

export type SortSession = {
  version: 1;
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
  portugueseMode: PortugueseMode;
  tab: SorterTab;
  status: SorterStatus;
  mode: ClassifierMode;
  progress: { done: number; total: number; failed: number };
};

export type SorterAction =
  | { type: "session/restored"; session: SortSession }
  | { type: "session/imported"; result: ImportResult; source: SourceFolder }
  | { type: "session/cleared" }
  | { type: "status/changed"; status: SorterStatus }
  | { type: "classify/started"; total: number }
  | { type: "classify/resolved"; results: ClassifyResultItem[]; mode: ClassifierMode }
  | { type: "classify/finished" }
  | { type: "item/assigned"; id: string; folderId: string }
  | { type: "item/reset"; id: string }
  | { type: "threshold/changed"; value: number }
  | { type: "portuguese/changed"; mode: PortugueseMode }
  | { type: "tab/changed"; tab: SorterTab }
  | { type: "folders/changed"; folders: TargetFolder[] };
