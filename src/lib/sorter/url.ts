import type { DuplicateRecord, ParsedBookmark } from "@/lib/sorter/types";

/**
 * Query parameters that identify where a link was shared, not what it points at. Two URLs that
 * differ only by these are the same page saved twice.
 */
const TRACKING_PARAMS = [
  /^utm_/i,
  /^ref$/i,
  /^ref_/i,
  /^source$/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^mc_cid$/i,
  /^mc_eid$/i,
  /^igshid$/i,
  /^trackingid$/i,
  /^si$/i,
  /^_hs(enc|mi)$/i,
];

function isTracking(key: string): boolean {
  return TRACKING_PARAMS.some((pattern) => pattern.test(key));
}

/**
 * Recovers the real URL from a tab-suspender placeholder.
 *
 * The Great Suspender and friends replace a tab with `chrome-extension://…/suspended.html#…&uri=<real>`.
 * Saved as a bookmark, that link is dead, and everything useful about it — the title, the actual
 * URL — lives in the fragment. Left alone these would be classified and exported as garbage.
 */
export function unwrapSuspendedUrl(raw: string): string {
  if (!raw.startsWith("chrome-extension://")) return raw;
  const fragment = raw.slice(raw.indexOf("#") + 1);
  const uri = new URLSearchParams(fragment).get("uri");
  return uri && /^https?:\/\//i.test(uri) ? uri : raw;
}

/**
 * A comparison key for a URL: same page → same string.
 *
 * Forces https and drops `www.`, which can in rare cases merge two genuinely distinct hosts.
 * That trade is deliberate — the alternative leaves obvious duplicates in the list — and the
 * summary sentence names every dropped title so a bad merge is visible rather than silent.
 *
 * Non-URL hrefs (`javascript:`, `place:`, a malformed export) are returned lowercased and
 * trimmed so they still compare sanely instead of throwing.
 */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return trimmed.toLowerCase();
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return trimmed.toLowerCase();
  }

  url.protocol = "https:";
  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");

  const kept = [...url.searchParams.entries()]
    .filter(([key]) => !isTracking(key))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  url.search = "";
  for (const [key, value] of kept) url.searchParams.append(key, value);

  // "/path/" and "/path" are the same page; "/" alone is not a trailing slash worth dropping.
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString();
}

/**
 * Keeps the first bookmark for each normalized URL and reports the rest.
 *
 * Earliest-wins rather than best-title-wins: the first occurrence is the one whose folder the
 * user filed it under deliberately, and it carries the older ADD_DATE.
 */
export function dedupe(bookmarks: ParsedBookmark[]): {
  kept: ParsedBookmark[];
  duplicates: DuplicateRecord[];
} {
  const seen = new Map<string, ParsedBookmark>();
  const kept: ParsedBookmark[] = [];
  const duplicates: DuplicateRecord[] = [];

  for (const bookmark of bookmarks) {
    const existing = seen.get(bookmark.normalizedUrl);
    if (existing) {
      duplicates.push({
        keptId: existing.id,
        url: bookmark.url,
        title: bookmark.title,
      });
      continue;
    }
    seen.set(bookmark.normalizedUrl, bookmark);
    kept.push(bookmark);
  }

  return { kept, duplicates };
}
