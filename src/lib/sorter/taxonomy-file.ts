import { z } from "zod";

import { uniqueFolderId } from "@/lib/sorter/taxonomy";
import type { TargetFolder } from "@/lib/sorter/types";

/**
 * Reads a taxonomy out of a JSON file.
 *
 * Kept free of React so it can be exercised directly, and free of `server-only` so the dialog can
 * call it in the browser — the file never leaves the machine, exactly like the bookmarks HTML.
 *
 * The limits below are not arbitrary: they are the same numbers `classifyBatchAction` validates
 * against. A file that slips past this parser but fails there would break every batch of a run
 * with a message about nothing, so the two must agree. See `FolderSchema` in
 * `src/app/sort-actions.ts`.
 */

/** Matches `BatchSchema.folders` on the server. */
const MAX_FOLDERS = 40;
const MAX_ID = 64;
const MAX_NAME = 120;
const MAX_DESCRIPTION = 1000;

const FolderInput = z.object({
  /**
   * Optional. When present it is trusted verbatim, which is what lets an edited file be
   * re-uploaded without discarding every suggestion: ids are the identity the cache and the
   * `folders/changed` reducer key on, so a file that keeps them keeps its history.
   */
  id: z.string().max(MAX_ID).optional(),
  name: z.string().max(MAX_NAME),
  /** The text Jev reads. Tolerated empty so a names-only file imports, then warned about. */
  description: z.string().max(MAX_DESCRIPTION).optional(),
  drawsFrom: z.array(z.string().max(MAX_NAME)).optional(),
});

export type TaxonomyFileResult =
  | { ok: true; folders: TargetFolder[] }
  | { ok: false; error: string };

function fail(error: string): TaxonomyFileResult {
  return { ok: false, error };
}

/**
 * Parses and validates the text of an uploaded file.
 *
 * Every failure names the actual problem and, where it can, the offending entry — an uploader
 * that only says "invalid file" leaves you diffing JSON by eye.
 */
export function parseTaxonomyJson(text: string): TaxonomyFileResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail("That file is not valid JSON.");
  }

  if (!Array.isArray(raw)) {
    return fail(
      'Expected a list of folders, like [{ "name": "Accessibility", "description": "…" }].',
    );
  }
  if (raw.length === 0) {
    return fail("That file has no folders in it.");
  }
  if (raw.length > MAX_FOLDERS) {
    return fail(
      `That file has ${raw.length} folders. The most Jev can sort into at once is ${MAX_FOLDERS}.`,
    );
  }

  const folders: TargetFolder[] = [];

  for (const [index, entry] of raw.entries()) {
    const position = index + 1;
    const parsed = FolderInput.safeParse(entry);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path[0];
      if (field === "name") return fail(`Folder ${position} needs a name.`);
      if (field === "description") {
        return fail(
          `Folder ${position}'s description is longer than ${MAX_DESCRIPTION} characters.`,
        );
      }
      if (field === "id") return fail(`Folder ${position} has an id longer than ${MAX_ID} characters.`);
      return fail(`Folder ${position} is not shaped like a folder.`);
    }

    const name = parsed.data.name.trim();
    if (name.length === 0) return fail(`Folder ${position} needs a name.`);

    // Ids are resolved against what has been accepted so far, so two folders named the same in
    // one file get distinct ids rather than the second silently shadowing the first.
    const id = parsed.data.id?.trim() || uniqueFolderId(name, folders);
    if (folders.some((folder) => folder.id === id)) {
      return fail(`Two folders share the id “${id}”. Ids have to be unique.`);
    }

    folders.push({
      id,
      name,
      description: parsed.data.description?.trim() ?? "",
      ...(parsed.data.drawsFrom && { drawsFrom: parsed.data.drawsFrom }),
    });
  }

  return { ok: true, folders };
}

/** Folders that would reach Jev as a bare label. Not an error — worth saying out loud. */
export function foldersMissingDescriptions(folders: TargetFolder[]): TargetFolder[] {
  return folders.filter((folder) => folder.description.trim().length === 0);
}
