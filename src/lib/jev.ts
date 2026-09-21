import "server-only";

import { gateway } from "@ai-sdk/gateway";
import { experimental_evaluate as evaluate } from "ai";

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
