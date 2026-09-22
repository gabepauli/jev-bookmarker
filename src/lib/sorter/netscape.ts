import { detectPortuguese } from "@/lib/sorter/language";
import type {
  FolderPath,
  ImportResult,
  ParsedBookmark,
  SourceFolder,
} from "@/lib/sorter/types";
import { dedupe, normalizeUrl, unwrapSuspendedUrl } from "@/lib/sorter/url";

/**
 * Netscape bookmark files, read and written.
 *
 * `parseNetscapeHtml` needs a DOM, so it only runs in the browser — do not import it from a
 * Server Component. `walkBookmarkTree` takes a `Document` directly so the same logic can be
 * driven by any parser. Everything else in this file is pure.
 *
 * The format is malformed by design: `<DT>` and `<p>` are never closed. Browsers parse it
 * anyway, and the resulting shape is the non-obvious part. `</dt>` may only be omitted before
 * another `DT`/`DD` or the parent's close, so a nested `<DL>` following an `<H3>` becomes a
 * *child of the `<DT>`*, not a sibling of the `<H3>`:
 *
 *     <dt><h3>Folder</h3><dl>…children…</dl></dt>
 *
 * Verified against headless Chromium on a real Chrome export rather than assumed.
 */

const LINK_SEPARATOR = " / ";

/** Walks a parsed bookmark document into a flat list plus the folder tree it came from. */
export function walkBookmarkTree(doc: Document): {
  bookmarks: Omit<ParsedBookmark, "originalFolder" | "isPortuguese">[];
  folders: SourceFolder[];
} {
  const bookmarks: Omit<ParsedBookmark, "originalFolder" | "isPortuguese">[] = [];
  const folders = new Map<string, SourceFolder>();
  let nextId = 0;

  const walk = (list: Element, path: FolderPath): void => {
    for (const child of list.children) {
      if (child.tagName !== "DT") continue;

      const heading = child.firstElementChild;
      if (heading?.tagName === "H3") {
        const name = (heading.textContent ?? "").trim() || "Untitled folder";
        const nested = path.concat(name);
        registerFolder(folders, nested);

        // The nested list is normally a child of this DT. Some exporters emit it as a sibling
        // instead, so fall back to that rather than silently dropping the folder's contents.
        const inner =
          child.querySelector(":scope > DL") ??
          (child.nextElementSibling?.tagName === "DL"
            ? child.nextElementSibling
            : null);
        if (inner) walk(inner, nested);
        continue;
      }

      const anchor = child.querySelector(":scope > A[href]");
      if (!anchor) continue;

      const url = unwrapSuspendedUrl(anchor.getAttribute("href") ?? "");
      if (!url) continue;

      const addDate = anchor.getAttribute("add_date") ?? undefined;
      bookmarks.push({
        id: `b${nextId++}`,
        url,
        normalizedUrl: normalizeUrl(url),
        title: (anchor.textContent ?? "").trim() || url,
        // An ADD_DATE of "0" is Chrome's "unknown", not an actual 1970 timestamp.
        addDate: addDate && addDate !== "0" ? addDate : undefined,
        path,
      });
      countLink(folders, path);
    }
  };

  for (const list of doc.querySelectorAll("body > dl")) {
    walk(list, []);
  }

  return { bookmarks, folders: sortFolders([...folders.values()]) };
}

function folderKey(path: FolderPath): string {
  return path.join("\u0000");
}

function registerFolder(folders: Map<string, SourceFolder>, path: FolderPath): void {
  const key = folderKey(path);
  if (folders.has(key)) return;
  folders.set(key, {
    key,
    path,
    label: path[path.length - 1] ?? "Bookmarks",
    depth: path.length,
    directLinks: 0,
    totalLinks: 0,
  });
}

/** Credits a link to its own folder and to every ancestor, so `totalLinks` is a subtree count. */
function countLink(folders: Map<string, SourceFolder>, path: FolderPath): void {
  for (let depth = path.length; depth >= 1; depth -= 1) {
    const ancestor = folders.get(folderKey(path.slice(0, depth)));
    if (!ancestor) continue;
    ancestor.totalLinks += 1;
    if (depth === path.length) ancestor.directLinks += 1;
  }
}

function sortFolders(folders: SourceFolder[]): SourceFolder[] {
  return folders.sort((a, b) => folderKey(a.path).localeCompare(folderKey(b.path)));
}

/**
 * Parses a bookmarks export in the browser.
 *
 * ICON attributes are never read — they are ~83% of a typical Chrome export's bytes, so the
 * only cost they carry is the initial parse. The `Document` goes out of scope as soon as the
 * walk returns so the DOM can be collected.
 */
export function parseNetscapeHtml(html: string): {
  bookmarks: Omit<ParsedBookmark, "originalFolder" | "isPortuguese">[];
  folders: SourceFolder[];
} {
  if (typeof DOMParser === "undefined") {
    throw new Error("parseNetscapeHtml needs a DOM. Call it from the browser.");
  }
  return walkBookmarkTree(new DOMParser().parseFromString(html, "text/html"));
}

/** True when `path` is `root` or sits beneath it. */
function isUnder(path: FolderPath, root: FolderPath): boolean {
  if (path.length < root.length) return false;
  return root.every((segment, index) => path[index] === segment);
}

/**
 * Narrows a parsed file to one subtree and finishes each bookmark: the folder trail relative to
 * the subtree root, the language guess, and duplicate removal.
 */
export function scopeToFolder(
  parsed: { bookmarks: Omit<ParsedBookmark, "originalFolder" | "isPortuguese">[]; folders: SourceFolder[] },
  source: SourceFolder,
): ImportResult {
  const scoped: ParsedBookmark[] = [];

  for (const bookmark of parsed.bookmarks) {
    if (!isUnder(bookmark.path, source.path)) continue;
    const trail = bookmark.path.slice(source.path.length);
    scoped.push({
      ...bookmark,
      originalFolder: trail.join(LINK_SEPARATOR) || source.label,
      isPortuguese: detectPortuguese(bookmark.title, bookmark.url).isPortuguese,
    });
  }

  const { kept, duplicates } = dedupe(scoped);
  return {
    bookmarks: kept,
    folders: parsed.folders,
    duplicates,
    totalParsed: scoped.length,
  };
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

/**
 * Escapes for attribute and text content alike. The parser entity-decodes on the way in, so
 * everything must be re-escaped on the way out. Emoji and accented characters pass through
 * untouched — the file is UTF-8 and says so in its META.
 */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ESCAPES[char]);
}

export type ExportGroup = {
  name: string;
  bookmarks: ParsedBookmark[];
  /** Emitted beside the sorted folder rather than inside it. */
  sibling?: boolean;
};

function renderLink(bookmark: ParsedBookmark, indent: string): string {
  // Verbatim or absent. Synthesizing a date here would silently rewrite bookmark history.
  const addDate = bookmark.addDate
    ? ` ADD_DATE="${escapeHtml(bookmark.addDate)}"`
    : "";
  return `${indent}<DT><A HREF="${escapeHtml(bookmark.url)}"${addDate}>${escapeHtml(bookmark.title)}</A>`;
}

function renderFolder(
  name: string,
  bookmarks: ParsedBookmark[],
  indent: string,
  now: number,
): string[] {
  return [
    `${indent}<DT><H3 ADD_DATE="${now}" LAST_MODIFIED="${now}">${escapeHtml(name)}</H3>`,
    `${indent}<DL><p>`,
    ...bookmarks.map((bookmark) => renderLink(bookmark, `${indent}    `)),
    `${indent}</DL><p>`,
  ];
}

/**
 * Writes a standalone bookmarks file: one folder named `rootName` holding the topic folders,
 * with any `sibling` groups emitted next to it. Empty groups are skipped.
 *
 * The DOCTYPE must be the first line byte-for-byte or Chrome refuses the import.
 */
export function serializeNetscapeHtml(
  rootName: string,
  groups: ExportGroup[],
): string {
  const now = Math.floor(Date.now() / 1000);
  const nested = groups.filter((group) => !group.sibling && group.bookmarks.length > 0);
  const siblings = groups.filter((group) => group.sibling && group.bookmarks.length > 0);

  const lines = [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    "<!-- This is an automatically generated file.",
    "     It will be read and overwritten.",
    "     DO NOT EDIT! -->",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Bookmarks</TITLE>",
    "<H1>Bookmarks</H1>",
    "<DL><p>",
    `    <DT><H3 ADD_DATE="${now}" LAST_MODIFIED="${now}">${escapeHtml(rootName)}</H3>`,
    "    <DL><p>",
    ...nested.flatMap((group) =>
      renderFolder(group.name, group.bookmarks, "        ", now),
    ),
    "    </DL><p>",
    ...siblings.flatMap((group) =>
      renderFolder(group.name, group.bookmarks, "    ", now),
    ),
    "</DL><p>",
    "",
  ];

  return lines.join("\n");
}

/** Suggests a filename like `ux-links-sorted-2026-09-21.html`. */
export function exportFilename(rootName: string): string {
  const slug =
    rootName
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\w]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "bookmarks";
  const today = new Date().toISOString().slice(0, 10);
  return `${slug}-sorted-${today}.html`;
}
