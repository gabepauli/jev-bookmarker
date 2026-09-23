"use server";

import { z } from "zod";

import { classifyPlacement, isJevConfigured, JevUnavailableError } from "@/lib/jev";
import { classifySample } from "@/lib/sorter/sample-classifier";
import type {
  ClassifyBatchResult,
  ClassifyResultItem,
  FolderSuggestion,
} from "@/lib/sorter/types";

/**
 * The one place the sorter crosses to the server.
 *
 * A `"use server"` file may only export async functions, so every type this deals in lives in
 * `src/lib/sorter/types.ts`. Nothing here revalidates: classification mutates nothing, and a
 * `revalidatePath` would attach a freshly rendered RSC payload to every batch response and
 * re-render the whole list mid-run.
 *
 * Next dispatches Server Actions one at a time per client, so batches arrive sequentially no
 * matter how the caller issues them. All the parallelism therefore has to live in here.
 */

const ItemSchema = z.object({
  id: z.string().max(64),
  url: z.string().max(2000),
  title: z.string().max(500),
  originalFolder: z.string().max(500),
});

const FolderSchema = z.object({
  id: z.string().max(64),
  name: z.string().max(120),
  description: z.string().max(1000),
});

const BatchSchema = z.object({
  items: z.array(ItemSchema).min(1).max(40),
  folders: z.array(FolderSchema).min(1).max(40),
});

/** In-flight gateway calls per batch. Higher draws 429s; lower wastes the round trip. */
const CONCURRENCY = 8;
/** One hung call must not hold up the batch behind it. */
const CALL_TIMEOUT_MS = 20_000;
const RETRY_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    sleep(ms).then<never>(() => {
      throw new Error(`Jev did not answer within ${ms / 1000}s.`);
    }),
  ]);
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Classification failed.";
}

export async function classifyBatchAction(
  input: unknown,
): Promise<ClassifyBatchResult> {
  const parsed = BatchSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid classification batch.");
  }
  const { items, folders } = parsed.data;

  const live = isJevConfigured();
  const mode: "jev" | "sample" = live ? "jev" : "sample";

  // The single swap point between the real model and the local stand-in.
  const classify = async (item: (typeof items)[number]): Promise<FolderSuggestion> =>
    live
      ? withTimeout(classifyPlacement(item, folders), CALL_TIMEOUT_MS)
      : classifySample(item, folders);

  const results: ClassifyResultItem[] = new Array(items.length);
  let cursor = 0;
  /** A missing credential is not a per-item problem; once it surfaces, stop paying for retries. */
  let unavailable: string | undefined;

  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];

      if (unavailable) {
        results[index] = { id: item.id, ok: false, error: unavailable };
        continue;
      }

      // Timed from here rather than around each attempt, so a retried item reports what it
      // actually cost — both calls and the delay between them — instead of only the lucky one.
      // Only the real classifier is timed: the stand-in is a synchronous keyword match, and
      // reporting its ~0ms as a latency would drag the average to nothing.
      const startedAt = performance.now();
      const elapsed = () => (live ? Math.round(performance.now() - startedAt) : undefined);

      try {
        results[index] = {
          id: item.id,
          ok: true,
          suggestion: await classify(item),
          ms: elapsed(),
        };
        continue;
      } catch (error) {
        if (error instanceof JevUnavailableError) {
          unavailable = error.message;
          results[index] = { id: item.id, ok: false, error: unavailable };
          continue;
        }

        // One retry covers a rate limit or a dropped connection; a second failure is real.
        await sleep(RETRY_DELAY_MS);
        try {
          results[index] = {
            id: item.id,
            ok: true,
            suggestion: await classify(item),
            ms: elapsed(),
          };
        } catch (retryError) {
          console.error(`Jev failed to place ${item.url}`, retryError);
          results[index] = { id: item.id, ok: false, error: describe(retryError) };
        }
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker),
  );

  return { mode, results };
}
