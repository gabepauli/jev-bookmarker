import type { TargetFolder } from "@/lib/sorter/types";

/**
 * The default target taxonomy.
 *
 * `description` is the text Jev actually reads, so it is prose about what belongs in the folder,
 * not a label. `drawsFrom` names the original folders each one mostly absorbs; it is a hint for
 * the taxonomy editor and is never sent to the model.
 *
 * The last two are routing outcomes rather than topics: they are emitted as siblings of the
 * sorted folder on export so they stay out of the topic tree.
 */
export const DEFAULT_FOLDERS: readonly TargetFolder[] = [
  {
    id: "research-and-testing",
    name: "Research and testing",
    description:
      "User interviews, surveys, usability testing, research analysis, repositories, research reports.",
    drawsFrom: ["Research", "Usability Test", "Articles"],
  },
  {
    id: "discovery-and-experimentation",
    name: "Discovery and experimentation",
    description:
      "Product discovery, hypotheses, assumptions, jobs to be done, opportunity trees, A/B tests.",
    drawsFrom: ["Discovery", "Hypothesis", "Jobs to be done"],
  },
  {
    id: "methods-and-process",
    name: "Methods and process",
    description:
      "Design thinking, double diamond, workshops, agile, user stories, estimation.",
    drawsFrom: ["Methodology", "Design Process"],
  },
  {
    id: "principles-and-psychology",
    name: "Principles and psychology",
    description:
      "Usability heuristics, laws of UX, cognitive load, decision psychology.",
    drawsFrom: ["Heuristics", "Principios de Design"],
  },
  {
    id: "flows-and-structure",
    name: "Flows and structure",
    description: "Information architecture, navigation, user flows, journey maps.",
    drawsFrom: ["Information Architecture", "Journey Map", "User Flow"],
  },
  {
    id: "ux-patterns",
    name: "UX patterns",
    description:
      "Onboarding, data tables, empty states, microinteractions, chatbot and conversation design.",
    drawsFrom: ["Chat bot"],
  },
  {
    id: "metrics-and-measurement",
    name: "Metrics and measurement",
    description:
      "UX metrics (SUS, SEQ, HEART, CES), product metrics, OKRs, measuring design impact.",
    drawsFrom: ["Metrics", "To organise", "Leading vs. Lagging indicators"],
  },
  {
    id: "product-strategy",
    name: "Product strategy",
    description:
      "Product vision, prioritisation, roadmaps, product-led growth, business value of design.",
    drawsFrom: ["Articles"],
  },
  {
    id: "design-ops-and-teams",
    name: "Design ops and teams",
    description:
      "DesignOps, ways of working, handoff, design debt, documentation, leadership.",
    drawsFrom: ["🤠 Design Ops", "Books"],
  },
  {
    id: "accessibility",
    name: "Accessibility",
    description: "WCAG, ARIA, screen readers, inclusive design and language.",
    drawsFrom: ["🦾 Accessibility", "WAI-ARIA", "Artigos", "Referências"],
  },
  {
    id: "career-and-hiring",
    name: "Career and hiring",
    description:
      "Job titles, hiring, portfolios, starting a new role, career growth.",
    drawsFrom: ["Articles"],
  },
  {
    id: "learning",
    name: "Learning",
    description: "Courses, study guides, blogs and publications you follow.",
    drawsFrom: ["Blogs", "Case Studie", "Challenges"],
  },
  {
    id: "templates-and-toolkits",
    name: "Templates and toolkits",
    description:
      "Worksheets, canvases, card decks, Miro templates, playbooks you use in your work.",
    drawsFrom: ["Recursos e Ferramentas", "Toolbox"],
  },
  {
    id: "apps-and-services",
    name: "Apps and services",
    description:
      "Software you use: testing, analytics, surveys, chatbot builders.",
    drawsFrom: ["Tools", "🧰 Tools"],
  },
  {
    id: "move-to-ui-links",
    name: "Move to UI Links",
    description:
      "Visual design resources: colour, fonts, illustrations, grids, animation, UI kits.",
    drawsFrom: ["🧰 Tools"],
  },
  {
    id: "not-design",
    name: "Not design",
    description: "Anything unrelated to design.",
    drawsFrom: ["🧰 Tools"],
  },
] as const;

/**
 * Folders emitted beside the sorted tree rather than inside it. They are routing decisions —
 * "this does not belong in this collection" — not topics.
 */
export const SIBLING_FOLDER_IDS: readonly string[] = [
  "move-to-ui-links",
  "not-design",
];

/**
 * Where a bookmark lands when Jev names a folder that no longer exists.
 *
 * Only meaningful for the default taxonomy. Anything that has a live folder list in hand should
 * call `fallbackFolderId` instead — an uploaded taxonomy will not contain this id, and stamping
 * an item with an id nothing recognises sends it silently to "Still to sort" on export.
 */
export const FALLBACK_FOLDER_ID = "not-design";

/**
 * The folder to fall back on within a given taxonomy: the designated one if it survived, else the
 * last in the list. Mirrors what the `folders/changed` reducer does when a folder is deleted.
 */
export function fallbackFolderId(folders: TargetFolder[]): string {
  const live = new Set(folders.map((folder) => folder.id));
  if (live.has(FALLBACK_FOLDER_ID)) return FALLBACK_FOLDER_ID;
  return folders[folders.length - 1]?.id ?? FALLBACK_FOLDER_ID;
}

export function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "folder";
}

/** A slug that does not collide with anything already in `folders`. */
export function uniqueFolderId(name: string, folders: TargetFolder[]): string {
  const taken = new Set(folders.map((folder) => folder.id));
  const base = slugify(name);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/**
 * The instruction for Jev's folder question.
 *
 * Lives here rather than in `jev.ts` because `jev.ts` is `server-only` and the folder smoke
 * script cannot import it. It used to be copied into both, which is how the copy in the script
 * ended up describing a prompt the app had stopped sending.
 *
 * No mention of a previous folder: `classifyPlacement` deliberately does not send one.
 */
export const FOLDER_QUESTION_INSTRUCTIONS =
  "Which single folder should this bookmark be filed in? Judge by what the page is actually about, reading the URL as well as the title — the title alone is often a publication name or a truncated headline.";

/**
 * The `criteria` object for Jev's `choice` question: id → the prose it evaluates against.
 *
 * The name is folded into the description so the model reads the label and the definition
 * together, while the key stays a stable slug. Building this at runtime is what costs us the
 * literal-type narrowing on the answer — see `classifyPlacement` in `src/lib/jev.ts`.
 */
export function buildCriteria(folders: TargetFolder[]): Record<string, string> {
  const criteria: Record<string, string> = {};
  for (const folder of folders) {
    criteria[folder.id] = `${folder.name} — ${folder.description}`;
  }
  return criteria;
}

/**
 * Identifies a taxonomy by what Jev would read. Suggestions cached under a different hash are
 * stale; manual overrides are not. Ids are included so that adding a folder invalidates too.
 */
export function taxonomyHash(folders: TargetFolder[]): string {
  const payload = folders
    .map((folder) => `${folder.id}\u0000${folder.name}\u0000${folder.description}`)
    .join("\u0001");

  // FNV-1a, 32-bit. Not cryptographic — this only needs to change when the text changes.
  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function folderById(
  folders: TargetFolder[],
  id: string | undefined,
): TargetFolder | undefined {
  return id === undefined ? undefined : folders.find((folder) => folder.id === id);
}

export function folderName(folders: TargetFolder[], id: string | undefined): string {
  return folderById(folders, id)?.name ?? "Unsorted";
}
