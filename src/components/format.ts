/**
 * Jev returns P(long-form), so the label needs an explicit threshold rather than a truthiness
 * check. Kept in a client-safe module so both server and client components can use it.
 */
const LONG_FORM_THRESHOLD = 0.5;

export function isLongFormLabel(probability: number): string {
  return probability > LONG_FORM_THRESHOLD ? "Long read" : "Quick read";
}

export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** A probability as a whole percent. Pair with `tabular-nums` so the column does not jitter. */
export function percent(probability: number): string {
  return `${Math.round(probability * 100)}%`;
}

/**
 * Shortens a deep folder trail from the middle, keeping the first and last segments — those are
 * the two that tell you where a bookmark came from.
 */
/**
 * A span of time, at the coarsest precision that still says something.
 *
 * Minutes drop the decimal because nobody reads "2m 14.3s"; seconds keep one because the gap
 * between 1.2s and 1.9s per bookmark is the interesting part. Pair with `tabular-nums` so a
 * ticking clock does not jitter.
 */
export function duration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms >= 60_000) {
    const minutes = Math.floor(ms / 60_000);
    const seconds = Math.round((ms % 60_000) / 1000);
    // 59.6s would otherwise render as "1m 60s".
    return seconds === 60 ? `${minutes + 1}m 0s` : `${minutes}m ${seconds}s`;
  }
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

export function folderTrail(trail: string, maxSegments = 3): string {
  const segments = trail.split(" / ");
  if (segments.length <= maxSegments) return trail;
  return `${segments[0]} / … / ${segments[segments.length - 1]}`;
}
