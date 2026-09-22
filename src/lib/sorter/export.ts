import {
  type ExportGroup,
  exportFilename,
  serializeNetscapeHtml,
} from "@/lib/sorter/netscape";
import { effectiveFolder } from "@/lib/sorter/session";
import { SIBLING_FOLDER_IDS } from "@/lib/sorter/taxonomy";
import type { SortSession } from "@/lib/sorter/types";

/** Where unplaced bookmarks go, so an export never silently loses one. */
const LEFTOVER_FOLDER = "Still to sort";

/**
 * Turns the session into the groups an export is written from.
 *
 * Language is not one of them. Portuguese bookmarks are filed by topic like everything else —
 * the badge on a row tells you what language it is in, which is all that was ever useful about
 * knowing.
 */
export function buildExportGroups(session: SortSession): ExportGroup[] {
  const byFolder = new Map<string, ExportGroup>();
  for (const folder of session.folders) {
    byFolder.set(folder.id, {
      name: folder.name,
      bookmarks: [],
      sibling: SIBLING_FOLDER_IDS.includes(folder.id),
    });
  }

  const leftover: ExportGroup = { name: LEFTOVER_FOLDER, bookmarks: [] };

  for (const bookmark of session.bookmarks) {
    const folderId = effectiveFolder(session.items[bookmark.id]);
    const group = folderId ? byFolder.get(folderId) : undefined;
    (group ?? leftover).bookmarks.push(bookmark);
  }

  const groups = [...byFolder.values()];
  if (leftover.bookmarks.length > 0) groups.push(leftover);
  return groups;
}

export function buildExportFile(session: SortSession): { name: string; html: string } {
  return {
    name: exportFilename(session.sourceLabel),
    html: serializeNetscapeHtml(session.sourceLabel, buildExportGroups(session)),
  };
}

/** Hands the file to the browser's downloader. */
export function downloadExport(session: SortSession): void {
  const { name, html } = buildExportFile(session);
  const url = URL.createObjectURL(
    new Blob([html], { type: "text/html;charset=utf-8" }),
  );

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  // Revoking immediately can cancel the download in some browsers; a tick is enough.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
