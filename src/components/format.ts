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
