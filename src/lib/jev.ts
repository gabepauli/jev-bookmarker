import "server-only";

import { gateway } from "@ai-sdk/gateway";
import { experimental_evaluate as evaluate } from "ai";

import { DISTRIBUTION_SIZE } from "@/lib/sorter/sample-classifier";
import {
  buildCriteria,
  fallbackFolderId,
  FOLDER_QUESTION_INSTRUCTIONS,
} from "@/lib/sorter/taxonomy";
import type {
  ClassifyRequestItem,
  FolderSuggestion,
  TargetFolder,
} from "@/lib/sorter/types";
import {
  type Category,
  type Classification,
  PRIORITY_LEVELS,
} from "@/lib/types";

/**
 * TypeSafe AI's Jev, served through the Vercel AI Gateway.
 *
 * Jev is an *evaluation* model, not a text model: it takes one shared state plus a set of
 * typed questions and returns a choice, a score, or a probability for each. There is no
 * `generateText` path, and no prompt to parse afterwards.
 */
export const JEV_MODEL_ID = "typesafe-ai/jev";

/** Above this, we call a bookmark long-form. Jev gives P(true), never a bare boolean. */
const LONG_FORM_THRESHOLD = 0.5;

export type BookmarkState = {
  url: string;
  title: string;
  excerpt: string;
};

/**
 * All three question types in one round trip. Jev evaluates every question against the same
 * state, so asking three costs one request rather than three.
 */
const QUESTIONS = {
  category: {
    type: "choice",
    instructions: "Which single category best describes this bookmark?",
    criteria: {
      engineering: "Programming, software architecture, infrastructure, developer tooling.",
      design: "User interface, user experience, visual, or product design.",
      business: "Startups, finance, strategy, marketing, management.",
      science: "Research papers, hard science, mathematics, academic work.",
      other: "Fits none of the other categories.",
    },
  },
  readingPriority: {
    type: "score",
    instructions:
      "How worth reading soon is this for a working software engineer? Weigh depth and practical usefulness over novelty.",
    criteria: [...PRIORITY_LEVELS],
  },
  isLongForm: {
    type: "boolean",
    instructions:
      "Is this long-form reading, taking more than roughly ten minutes to get through?",
  },
} as const;

export class JevUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JevUnavailableError";
  }
}

/** True when the gateway credential is present. Checked before every call so a missing key
 *  degrades to an unclassified bookmark instead of throwing deep inside the SDK. */
export function isJevConfigured(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY);
}

/**
 * Classify one bookmark. Throws {@link JevUnavailableError} when the gateway is not
 * configured; callers decide whether that is fatal.
 */
export async function classifyBookmark(
  state: BookmarkState,
): Promise<Classification> {
  if (!isJevConfigured()) {
    throw new JevUnavailableError(
      "AI_GATEWAY_API_KEY is not set, so bookmarks are saved without Jev classification.",
    );
  }

  const { answers, response } = await evaluate({
    model: gateway.evaluation(JEV_MODEL_ID),
    state,
    questions: QUESTIONS,
  });

  // `questions` is inferred with a const type parameter, so `choice` is narrowed to the
  // literal union of the criteria keys rather than plain `string`.
  const category: Category = answers.category.choice;

  return {
    category,
    categoryConfidence: answers.category.probabilities?.[category],
    priorityScore: answers.readingPriority.score,
    longFormProbability: answers.isLongForm.probability,
    modelId: response.modelId,
  };
}

export function isLongForm(probability: number): boolean {
  return probability > LONG_FORM_THRESHOLD;
}

/**
 * Asks Jev which of the user's folders a bookmark belongs in.
 *
 * Unlike `classifyBookmark`, the criteria here are built at runtime from a taxonomy the user can
 * edit, which costs the literal-type narrowing the other call site relies on: `answers.folder.choice`
 * comes back as a plain `string`, not a union of the folder ids. So the answer is validated
 * against the live taxonomy before it is trusted, and an unrecognized id falls back rather than
 * flowing into state as a folder that does not exist.
 *
 * The state is deliberately just the URL and the title. Fetching each page for an excerpt would
 * add a network round trip per bookmark, and the folder the bookmark already lived in is not sent
 * either: a source tree worth re-sorting is usually a source tree whose folders are noise, and the
 * damage is less the wrong folder than the confidence. A hint agreeing with a thin title pushes
 * the probability up, the row clears the review threshold, and it never gets shown to the user —
 * so a bad hint costs exactly the review that would have caught it. The stand-in in
 * `sample-classifier.ts` still scores it; that is a keyword matcher with nothing else to go on,
 * not a model of this one.
 */
export async function classifyPlacement(
  item: ClassifyRequestItem,
  folders: TargetFolder[],
): Promise<FolderSuggestion> {
  if (!isJevConfigured()) {
    throw new JevUnavailableError(
      "AI_GATEWAY_API_KEY is not set, so bookmarks cannot be sorted by Jev.",
    );
  }
  if (folders.length === 0) {
    throw new Error("Cannot classify into an empty taxonomy.");
  }

  const { answers, response } = await evaluate({
    model: gateway.evaluation(JEV_MODEL_ID),
    state: {
      url: item.url,
      title: item.title,
    },
    questions: {
      folder: {
        type: "choice",
        instructions: FOLDER_QUESTION_INSTRUCTIONS,
        criteria: buildCriteria(folders),
      },
    },
  });

  // Derived from the taxonomy in hand, not a constant: a user-supplied folder list need not
  // contain the default fallback, and an id nothing recognises would strand the bookmark.
  const known = new Set(folders.map((folder) => folder.id));
  const chosen = known.has(answers.folder.choice)
    ? answers.folder.choice
    : fallbackFolderId(folders);

  // `probabilities` is optional on a choice answer. Everything downstream renders an explicit
  // "no distribution" state rather than a NaN percentage, so leave it undefined when absent.
  const probabilities = answers.folder.probabilities;
  const distribution = probabilities
    ? Object.entries(probabilities)
        .filter(([folderId]) => known.has(folderId))
        .map(([folderId, p]) => ({ folderId, p }))
        .sort((a, b) => b.p - a.p)
        .slice(0, DISTRIBUTION_SIZE)
    : undefined;

  return {
    folderId: chosen,
    confidence: probabilities?.[chosen],
    distribution,
    source: "jev",
    modelId: response.modelId,
  };
}
