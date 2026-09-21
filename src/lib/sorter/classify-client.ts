import { classifyBatchAction } from "@/app/sort-actions";
import {
  cacheHit,
  loadCache,
  saveCache,
  type SuggestionCache,
} from "@/lib/sorter/persistence";
import { classifySample } from "@/lib/sorter/sample-classifier";
import { taxonomyHash } from "@/lib/sorter/taxonomy";
import type {
  ClassifierMode,
  ClassifyRequestItem,
  ClassifyResultItem,
  ParsedBookmark,
  TargetFolder,
} from "@/lib/sorter/types";

/**
 * Drives classification from the browser.
 *
 * The loop is plainly sequential because Next dispatches Server Actions one at a time per client
 * — issuing two batches concurrently would just queue the second one, so there is nothing to win
 * by pretending otherwise. All the parallelism lives inside `classifyBatchAction`.
 *
 * Results are reported a batch at a time rather than an item at a time: for a few hundred
 * bookmarks that is the difference between a dozen re-renders and several hundred.
 */

/** Items per round trip. Small enough to keep the progress bar moving, big enough to amortize it. */
const BATCH_SIZE = 24;

export type ClassifyRun = {
  onBatch: (results: ClassifyResultItem[], mode: ClassifierMode) => void;
  onProgress?: (done: number, total: number) => void;
  /** Checked between batches. An in-flight action cannot be aborted, so its result is discarded. */
  isCancelled?: () => boolean;
};

function toRequest(bookmark: ParsedBookmark): ClassifyRequestItem {
  return {
    id: bookmark.id,
    url: bookmark.url,
    title: bookmark.title,
    originalFolder: bookmark.originalFolder,
  };
}

/** Folders as the action wants them — `drawsFrom` is a UI hint and does not travel. */
function toPayload(folders: TargetFolder[]) {
  return folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    description: folder.description,
  }));
}

export async function classifyBookmarks(
  bookmarks: ParsedBookmark[],
  folders: TargetFolder[],
  jevConfigured: boolean,
  run: ClassifyRun,
): Promise<void> {
  if (bookmarks.length === 0 || folders.length === 0) return;

  const mode: "jev" | "sample" = jevConfigured ? "jev" : "sample";
  const hash = taxonomyHash(folders);
  let cache: SuggestionCache = loadCache();

  // Anything already known is resolved in one pass before a single request goes out.
  const cached: ClassifyResultItem[] = [];
  const pending: ParsedBookmark[] = [];
  for (const bookmark of bookmarks) {
    const hit = cacheHit(cache, bookmark.normalizedUrl, hash, mode);
    if (hit) cached.push({ id: bookmark.id, ok: true, suggestion: hit });
    else pending.push(bookmark);
  }

  const total = bookmarks.length;
  let done = 0;

  if (cached.length > 0) {
    done += cached.length;
    run.onBatch(cached, mode);
    run.onProgress?.(done, total);
  }

  // With no key there is nothing to wait for: score locally and hand back one batch.
  if (!jevConfigured) {
    const results: ClassifyResultItem[] = pending.map((bookmark) => ({
      id: bookmark.id,
      ok: true,
      suggestion: classifySample(toRequest(bookmark), folders),
    }));
    cache = saveCache(cache, cacheAdditions(pending, results, hash));
    run.onBatch(results, "sample");
    run.onProgress?.(total, total);
    return;
  }

  const payloadFolders = toPayload(folders);

  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    if (run.isCancelled?.()) return;

    const batch = pending.slice(start, start + BATCH_SIZE);
    let results: ClassifyResultItem[];
    let batchMode: ClassifierMode = mode;

    try {
      const response = await classifyBatchAction({
        items: batch.map(toRequest),
        folders: payloadFolders,
      });
      results = response.results;
      batchMode = response.mode;
    } catch (error) {
      // The action itself failed — a dropped connection, or a deploy that rotated its id. Mark
      // the batch so the rows offer a retry instead of sitting blank.
      const message =
        error instanceof Error ? error.message : "Could not reach the classifier.";
      results = batch.map((bookmark) => ({ id: bookmark.id, ok: false, error: message }));
    }

    if (run.isCancelled?.()) return;

    cache = saveCache(cache, cacheAdditions(batch, results, hash));
    done += results.length;
    run.onBatch(results, batchMode);
    run.onProgress?.(done, total);
  }
}

function cacheAdditions(
  bookmarks: ParsedBookmark[],
  results: ClassifyResultItem[],
  hash: string,
): SuggestionCache {
  const byId = new Map(bookmarks.map((bookmark) => [bookmark.id, bookmark]));
  const additions: SuggestionCache = {};
  const cachedAt = Date.now();

  for (const result of results) {
    if (!result.ok) continue;
    const bookmark = byId.get(result.id);
    if (!bookmark) continue;
    additions[bookmark.normalizedUrl] = {
      suggestion: result.suggestion,
      cachedAt,
      taxonomyHash: hash,
    };
  }
  return additions;
}
