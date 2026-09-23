import { initialSession } from "@/lib/sorter/session";
import type { FolderSuggestion, SortSession } from "@/lib/sorter/types";

/**
 * Session and classification cache in `localStorage`.
 *
 * Every read and write is wrapped: storage can be unavailable (private windows, blocked site
 * data) or full, and losing a sort is annoying but never a reason to take the page down. Reads
 * must also happen in a mount effect rather than during render — reading storage while rendering
 * would make the server and client trees disagree and blow up hydration.
 */

const SESSION_KEY = "jev-sorter:session:v1";
/**
 * Bumped to v2 when Jev stopped being sent the bookmark's previous folder. Every v1 entry was
 * produced against a different input, and `taxonomyHash` covers only the folder list, so nothing
 * else would notice they were stale.
 */
const CACHE_KEY = "jev-sorter:cache:v2";

/** Suggestions to keep across sessions. Roughly a dozen imports' worth. */
const CACHE_LIMIT = 2000;
const SAVE_DEBOUNCE_MS = 400;

export type CacheEntry = {
  suggestion: FolderSuggestion;
  cachedAt: number;
  /** The taxonomy this was produced against. A different one means it no longer applies. */
  taxonomyHash: string;
};

export type SuggestionCache = Record<string, CacheEntry>;

function read<T>(key: string): T | undefined {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Almost always QuotaExceededError. The session stays in memory and still works.
    return false;
  }
}

export function loadSession(): SortSession | undefined {
  const stored = read<SortSession>(SESSION_KEY);
  if (!stored || stored.version !== 1 || !Array.isArray(stored.bookmarks)) return undefined;

  // A session saved mid-run would come back stuck on a progress bar that will never move — and
  // on a run with no end, so its elapsed clock would read as time since yesterday.
  if (stored.status !== "classifying") return stored;
  return {
    ...stored,
    status: "ready",
    run: stored.run ? { ...stored.run, finishedAt: stored.run.finishedAt ?? Date.now() } : undefined,
  };
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing to do — an unreadable store is also an unwritable one.
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Writes the session at most every 400ms. Without the debounce, dragging the threshold slider
 * would serialize a few hundred bookmarks on every pointer move.
 */
export function saveSessionSoon(session: SortSession): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    if (session.bookmarks.length > 0) write(SESSION_KEY, session);
  }, SAVE_DEBOUNCE_MS);
}

export function loadCache(): SuggestionCache {
  return read<SuggestionCache>(CACHE_KEY) ?? {};
}

/**
 * Merges new suggestions in and trims the oldest back to the limit.
 *
 * Returns the merged cache so the caller can keep using it without re-reading storage, whether
 * or not the write itself succeeded.
 */
export function saveCache(
  cache: SuggestionCache,
  additions: SuggestionCache,
): SuggestionCache {
  const merged: SuggestionCache = { ...cache, ...additions };

  const keys = Object.keys(merged);
  if (keys.length > CACHE_LIMIT) {
    const survivors = keys
      .sort((a, b) => merged[b].cachedAt - merged[a].cachedAt)
      .slice(0, CACHE_LIMIT);
    const trimmed: SuggestionCache = {};
    for (const key of survivors) trimmed[key] = merged[key];
    write(CACHE_KEY, trimmed);
    return trimmed;
  }

  write(CACHE_KEY, merged);
  return merged;
}

/**
 * A cached suggestion that still applies, or undefined.
 *
 * A sample result is never reused once the real model is available: adding a gateway key and
 * re-running should upgrade the whole session rather than silently keeping the stand-in's
 * guesses.
 */
export function cacheHit(
  cache: SuggestionCache,
  normalizedUrl: string,
  taxonomyHash: string,
  mode: "jev" | "sample",
): FolderSuggestion | undefined {
  const entry = cache[normalizedUrl];
  if (!entry || entry.taxonomyHash !== taxonomyHash) return undefined;
  if (mode === "jev" && entry.suggestion.source === "sample") return undefined;
  return entry.suggestion;
}

/** A fresh session with the user's folder edits carried over. */
export function resetKeepingFolders(session: SortSession): SortSession {
  return { ...initialSession(), folders: session.folders, taxonomyHash: session.taxonomyHash };
}
