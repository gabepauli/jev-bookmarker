export const CATEGORIES = [
  "engineering",
  "design",
  "business",
  "science",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Ordered levels for Jev's `readingPriority` score question, lowest first. */
export const PRIORITY_LEVELS = [
  "Skip it",
  "Low priority",
  "Worth reading this week",
  "Read it now",
] as const;

export type Classification = {
  category: Category;
  /** Confidence in the chosen category, in [0, 1]. Undefined when Jev returned no distribution. */
  categoryConfidence?: number;
  /**
   * Jev returns a fractional position in [0, PRIORITY_LEVELS.length - 1], not a 0-1 value.
   * Stored raw; use `priorityFraction` to normalize for display.
   */
  priorityScore: number;
  /** Jev's estimated P(long-form), in [0, 1]. Not a boolean — threshold it at the call site. */
  longFormProbability: number;
  /** The concrete model version the gateway resolved `typesafe-ai/jev` to. */
  modelId: string;
};

export type Bookmark = {
  id: string;
  url: string;
  title: string;
  excerpt: string;
  createdAt: string;
  /** Undefined when classification was skipped (no API key) or failed. */
  classification?: Classification;
  /** Why classification is missing, surfaced in the UI. */
  classificationError?: string;
};

/** Normalize Jev's [0, n-1] score into [0, 1] for progress bars and percentages. */
export function priorityFraction(score: number): number {
  return score / (PRIORITY_LEVELS.length - 1);
}

/** The nearest named level for a fractional Jev score. */
export function priorityLabel(score: number): string {
  const index = Math.min(
    PRIORITY_LEVELS.length - 1,
    Math.max(0, Math.round(score)),
  );
  return PRIORITY_LEVELS[index];
}
