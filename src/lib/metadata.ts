import "server-only";

/**
 * Best-effort page metadata. Every failure path falls back to something derived from the URL,
 * because a bookmark that cannot be titled is still a bookmark worth saving.
 */
export type PageMetadata = { title: string; excerpt: string };

const FETCH_TIMEOUT_MS = 5_000;

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&apos;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function metaContent(html: string, ...names: string[]): string | undefined {
  for (const name of names) {
    // Matches both attribute orders: content-before-name and name-before-content.
    const pattern = new RegExp(
      `<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']|` +
        `<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`,
      "i",
    );
    const match = html.match(pattern);
    const value = match?.[1] ?? match?.[2];
    if (value) return decodeEntities(value);
  }
  return undefined;
}

function titleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const segment = parsed.pathname.split("/").filter(Boolean).pop();
    if (!segment) return parsed.hostname.replace(/^www\./, "");
    return decodeURIComponent(segment).replace(/[-_]+/g, " ").replace(/\.\w+$/, "");
  } catch {
    return url;
  }
}

export async function fetchPageMetadata(url: string): Promise<PageMetadata> {
  const fallback: PageMetadata = { title: titleFromUrl(url), excerpt: "" };

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": "jev-bookmarker/0.1 (+metadata fetch)" },
    });
    if (!response.ok) return fallback;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) return fallback;

    const html = (await response.text()).slice(0, 200_000);

    const title =
      metaContent(html, "og:title", "twitter:title") ??
      decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") ??
      "";

    const excerpt =
      metaContent(html, "description", "og:description", "twitter:description") ?? "";

    return {
      title: title || fallback.title,
      excerpt: excerpt || fallback.excerpt,
    };
  } catch {
    // Offline, blocked, timed out, or not a real page. Save it anyway.
    return fallback;
  }
}
