import { FALLBACK_FOLDER_ID } from "@/lib/sorter/taxonomy";
import type {
  ClassifyRequestItem,
  FolderOdds,
  FolderSuggestion,
  TargetFolder,
} from "@/lib/sorter/types";

/**
 * A stand-in for Jev that runs locally.
 *
 * This exists so the whole interface is usable — and reviewable — with no gateway key. It is
 * imported from both sides of the boundary: the client runs it directly when Jev is not
 * configured (instant for a few hundred bookmarks, no round trips), and `classifyBatchAction`
 * falls back to it so there is one implementation rather than two that drift.
 *
 * Keep it free of `server-only` imports and browser globals.
 */

/**
 * Words that pull toward a folder, beyond the folder's own description.
 *
 * The description alone is too sparse to separate "usability testing" from "usability
 * heuristics", and these bookmarks are a mix of English and Portuguese, so the Portuguese terms
 * are here too.
 */
const HINTS: Record<string, string[]> = {
  "research-and-testing": [
    "research", "pesquisa", "interview", "entrevista", "survey", "usability", "usabilidade",
    "user test", "teste", "participant", "baymard", "dovetail", "ethnograph", "diary study",
    "rainbow sheet", "insight", "findings", "respondent",
  ],
  "discovery-and-experimentation": [
    "discovery", "hypothes", "hipótes", "assumption", "suposi", "jobs to be done", "jtbd",
    "opportunity", "experiment", "experimenta", "a/b test", "ab test", "continuous discovery",
    "dual track", "problem space",
  ],
  "methods-and-process": [
    "process", "processo", "method", "metodologia", "design thinking", "double diamond",
    "workshop", "agile", "scrum", "sprint", "user stor", "estimat", "kanban", "framework",
    "facilitat", "brainstorm", "six thinking hats", "canvas",
  ],
  "principles-and-psychology": [
    "heuristic", "heurística", "principle", "princípio", "laws of ux", "cognitive", "cognitiva",
    "psycholog", "psicologia", "bias", "viés", "gestalt", "mental model", "persuas", "behaviou",
    "behavio", "decision",
  ],
  "flows-and-structure": [
    "information architecture", "arquitetura da informação", "navigation", "navega", "user flow",
    "fluxo", "journey", "jornada", "sitemap", "card sort", "taxonom", "wayfinding", "ia ",
  ],
  "ux-patterns": [
    "pattern", "padrão", "onboarding", "empty state", "data table", "microinteraction",
    "chatbot", "chat bot", "conversation", "conversacional", "form design", "checkout", "modal",
    "notification", "search ux", "voice ui",
  ],
  "metrics-and-measurement": [
    "metric", "métrica", "sus", "seq", "heart", "ces", "nps", "okr", "kpi", "measur", "medir",
    "medindo", "analytics", "retenção", "retention", "engajamento", "engagement", "impact",
    "indicator", "indicador", "benchmark",
  ],
  "product-strategy": [
    "strategy", "estratégia", "vision", "visão", "roadmap", "prioriti", "prioriza", "backlog",
    "product-led", "growth", "business value", "stakeholder", "positioning", "market",
    "product manage", "north star",
  ],
  "design-ops-and-teams": [
    "designops", "design ops", "ways of working", "handoff", "design debt", "documentation",
    "documenta", "leadership", "lideran", "team", "time de design", "rituals", "maturity",
    "governance", "hiring process", "critique", "operations",
  ],
  accessibility: [
    "accessib", "acessibilidade", "a11y", "wcag", "aria", "screen reader", "leitor de tela",
    "inclusive", "inclusiv", "contrast", "contraste", "keyboard navigation", "deaf", "blind",
  ],
  "career-and-hiring": [
    "career", "carreira", "hiring", "contrata", "job title", "portfolio", "portfólio",
    "interview process", "salary", "salário", "promotion", "new role", "first 90 days",
    "junior", "senior", "mentor",
  ],
  learning: [
    "course", "curso", "learn", "aprend", "study", "estudo", "blog", "newsletter", "podcast",
    "book", "livro", "case study", "guide", "guia", "tutorial", "bootcamp", "challenge",
    "publication", "medium.com",
  ],
  "templates-and-toolkits": [
    "template", "modelo", "canvas", "worksheet", "toolkit", "playbook", "miro", "figjam",
    "card deck", "checklist", "kit", "recursos", "ferramenta", "boilerplate", "cheat sheet",
  ],
  "apps-and-services": [
    "tool", "app", "software", "platform", "plataforma", "saas", "plugin", "integration",
    "dashboard", "maze", "hotjar", "optimal workshop", "useberry", "lookback", "typeform",
    "webflow", "notion", "airtable", "pricing",
  ],
  "move-to-ui-links": [
    "color", "colour", "cores", "font", "tipografia", "typograph", "illustration", "ilustra",
    "icon", "ícone", "grid", "animation", "animação", "ui kit", "design system", "component",
    "shadow", "gradient", "css", "figma plugin", "inspiration", "mockup",
  ],
  "not-design": [
    "recipe", "travel", "shopping", "sports", "finance pessoal", "crypto", "news", "weather",
  ],
};

/** Every folder starts here, so an unmatched bookmark spreads rather than snapping to one. */
const BASE_SCORE = 0.4;
/** The original folder is the strongest signal available, so it outweighs the title. */
const FOLDER_WEIGHT = 2.5;
const TITLE_WEIGHT = 1;
const URL_WEIGHT = 0.6;
/**
 * Sharpens the distribution. Tuned against the real 259-bookmark set rather than picked: at 3
 * the stand-in claimed 95%+ on 174 of them, which is not a believable thing for a keyword
 * matcher that has never seen the page to say. At 1.4 the median lands near 0.78 and about a
 * third fall under the default review threshold, which is roughly the review load the design
 * assumes.
 */
const TEMPERATURE = 1.4;
/** Spread of the deterministic per-URL wobble. See the note on `jitter` below. */
const JITTER = 0.07;
/**
 * How many folders to keep in the stored distribution. The chips show three; a couple of spares
 * cost nothing. Keeping all sixteen for every bookmark is most of a session's localStorage
 * footprint and nothing reads past the top few.
 */
export const DISTRIBUTION_SIZE = 5;

/** FNV-1a. Gives each URL a fixed pseudo-random number, so results never move between runs. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A small, stable offset per (folder, url) pair.
 *
 * Without it every bookmark that matched one keyword would come back at an identical
 * confidence, and nothing would ever fall below the review threshold — the "needs a look" tab,
 * the amber dots and the top-picks chips would all be dead UI in sample mode. This is the one
 * place the stand-in deliberately imitates a model's uncertainty rather than its knowledge.
 */
function jitter(folderId: string, url: string): number {
  return ((hash(`${folderId}:${url}`) % 2000) / 1000 - 1) * JITTER;
}

function countHits(haystack: string, needles: string[]): number {
  let hits = 0;
  for (const needle of needles) {
    if (haystack.includes(needle)) hits += 1;
  }
  return hits;
}

/** Descriptions are prose, so only their distinctive words are worth matching. */
function descriptionTerms(folder: TargetFolder): string[] {
  return folder.description
    .toLowerCase()
    .split(/[^\p{Letter}]+/u)
    .filter((word) => word.length >= 5);
}

function softmax(scores: number[]): number[] {
  const max = Math.max(...scores);
  const exps = scores.map((score) => Math.exp((score - max) * TEMPERATURE));
  const total = exps.reduce((sum, value) => sum + value, 0);
  return exps.map((value) => value / total);
}

/**
 * Scores a bookmark against every folder and returns a full distribution.
 *
 * Deterministic: the same bookmark and taxonomy always produce the same answer, so reloading
 * the page never reshuffles the list.
 */
export function classifySample(
  item: ClassifyRequestItem,
  folders: TargetFolder[],
): FolderSuggestion {
  if (folders.length === 0) {
    return { folderId: FALLBACK_FOLDER_ID, confidence: 1, source: "sample" };
  }

  const title = item.title.toLowerCase();
  const folderPath = item.originalFolder.toLowerCase();
  const url = item.url.toLowerCase();

  const scores = folders.map((folder) => {
    // A folder added in the taxonomy editor has no hand-written hints, so fall back to the
    // distinctive words of whatever description the user wrote for it.
    const terms = HINTS[folder.id] ?? descriptionTerms(folder);

    return (
      BASE_SCORE +
      FOLDER_WEIGHT * countHits(folderPath, terms) +
      TITLE_WEIGHT * countHits(title, terms) +
      URL_WEIGHT * countHits(url, terms) +
      jitter(folder.id, item.url)
    );
  });

  const probabilities = softmax(scores);
  const ranked: FolderOdds[] = folders
    .map((folder, index) => ({ folderId: folder.id, p: probabilities[index] }))
    .sort((a, b) => b.p - a.p);

  return {
    folderId: ranked[0].folderId,
    confidence: ranked[0].p,
    distribution: ranked.slice(0, DISTRIBUTION_SIZE),
    source: "sample",
  };
}

/** Matches the shape of the real classifier so the two are interchangeable at one call site. */
export async function classifySampleAsync(
  item: ClassifyRequestItem,
  folders: TargetFolder[],
): Promise<FolderSuggestion> {
  return classifySample(item, folders);
}
