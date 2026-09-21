"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  addBookmark as persist,
  deleteBookmark as remove,
  getBookmark,
  updateBookmark,
} from "@/lib/bookmarks";
import { classifyBookmark, JevUnavailableError } from "@/lib/jev";
import { fetchPageMetadata } from "@/lib/metadata";
import type { Classification } from "@/lib/types";

export type ActionState = { error?: string; ok?: boolean };

const AddBookmarkSchema = z.object({
  url: z.url({ message: "Enter a valid URL, including https://" }),
  title: z.string().trim().max(300).optional(),
  excerpt: z.string().trim().max(2000).optional(),
});

/**
 * Classify without letting a gateway problem block the save. A bookmark the user asked to
 * keep is more important than its tags, so failures come back as a message to render.
 */
async function classifyOrExplain(state: {
  url: string;
  title: string;
  excerpt: string;
}): Promise<{ classification?: Classification; classificationError?: string }> {
  try {
    return { classification: await classifyBookmark(state) };
  } catch (error) {
    if (error instanceof JevUnavailableError) {
      return { classificationError: error.message };
    }
    console.error("Jev classification failed", error);
    return {
      classificationError:
        error instanceof Error
          ? `Jev classification failed: ${error.message}`
          : "Jev classification failed.",
    };
  }
}

export async function addBookmarkAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = AddBookmarkSchema.safeParse({
    url: formData.get("url"),
    title: formData.get("title") || undefined,
    excerpt: formData.get("excerpt") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid bookmark." };
  }

  const { url } = parsed.data;

  // Only fetch the page when the user left a field blank.
  const needsMetadata = !parsed.data.title || !parsed.data.excerpt;
  const fetched = needsMetadata
    ? await fetchPageMetadata(url)
    : { title: "", excerpt: "" };

  const title = parsed.data.title || fetched.title;
  const excerpt = parsed.data.excerpt || fetched.excerpt;

  const result = await classifyOrExplain({ url, title, excerpt });

  persist({ url, title, excerpt, ...result });
  revalidatePath("/");
  return { ok: true };
}

export async function reclassifyBookmarkAction(id: string): Promise<void> {
  const bookmark = getBookmark(id);
  if (!bookmark) return;

  const result = await classifyOrExplain({
    url: bookmark.url,
    title: bookmark.title,
    excerpt: bookmark.excerpt,
  });

  updateBookmark(id, {
    classification: result.classification,
    classificationError: result.classificationError,
  });
  revalidatePath("/");
}

export async function deleteBookmarkAction(id: string): Promise<void> {
  remove(id);
  revalidatePath("/");
}
