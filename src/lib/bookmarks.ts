import "server-only";

import { randomUUID } from "node:crypto";

import type { Bookmark } from "@/lib/types";

/**
 * In-memory store, seeded on first access.
 *
 * This is per-process and resets when the server restarts — fine for local development, not
 * durable on serverless where each invocation may get a fresh process. Everything else in the
 * app goes through the functions below, so swapping in a real database touches only this file.
 *
 * Pinned to `globalThis` so Next's dev-mode hot reload doesn't wipe bookmarks on every edit.
 */
type Store = { items: Bookmark[] };

const globalStore = globalThis as typeof globalThis & {
  __bookmarkStore?: Store;
};

function store(): Store {
  globalStore.__bookmarkStore ??= { items: seed() };
  return globalStore.__bookmarkStore;
}

function seed(): Bookmark[] {
  const base = Date.now();
  const at = (minutesAgo: number) =>
    new Date(base - minutesAgo * 60_000).toISOString();

  return [
    {
      id: randomUUID(),
      url: "https://react.dev/reference/react/useEffect",
      title: "useEffect – React",
      excerpt:
        "Reference documentation for the useEffect hook, covering dependencies, cleanup functions, and the cases where you do not need an effect at all.",
      createdAt: at(15),
      classification: {
        category: "engineering",
        categoryConfidence: 0.94,
        priorityScore: 2.4,
        longFormProbability: 0.71,
        modelId: "typesafe-ai/jev",
      },
    },
    {
      id: randomUUID(),
      url: "https://www.nngroup.com/articles/ten-usability-heuristics/",
      title: "10 Usability Heuristics for User Interface Design",
      excerpt:
        "Jakob Nielsen's ten general principles for interaction design, each a broad rule of thumb rather than a specific usability guideline.",
      createdAt: at(90),
      classification: {
        category: "design",
        categoryConfidence: 0.88,
        priorityScore: 1.8,
        longFormProbability: 0.34,
        modelId: "typesafe-ai/jev",
      },
    },
    {
      id: randomUUID(),
      url: "https://arxiv.org/abs/1706.03762",
      title: "Attention Is All You Need",
      excerpt:
        "Introduces the Transformer, a network architecture based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.",
      createdAt: at(300),
      classification: {
        category: "science",
        categoryConfidence: 0.91,
        priorityScore: 3,
        longFormProbability: 0.96,
        modelId: "typesafe-ai/jev",
      },
    },
    {
      id: randomUUID(),
      url: "https://www.paulgraham.com/good.html",
      title: "Be Good",
      excerpt:
        "An essay arguing that making something people want, and being benevolent about it, works surprisingly well as a startup strategy.",
      createdAt: at(1440),
      classification: {
        category: "business",
        categoryConfidence: 0.79,
        priorityScore: 1.2,
        longFormProbability: 0.52,
        modelId: "typesafe-ai/jev",
      },
    },
    {
      id: randomUUID(),
      url: "https://news.ycombinator.com/",
      title: "Hacker News",
      excerpt: "A link aggregator for startup and technology news.",
      createdAt: at(2880),
      classificationError: "Classification was skipped for this seeded bookmark.",
    },
  ];
}

export function listBookmarks(): Bookmark[] {
  return [...store().items].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function addBookmark(
  bookmark: Omit<Bookmark, "id" | "createdAt">,
): Bookmark {
  const created: Bookmark = {
    ...bookmark,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  store().items.push(created);
  return created;
}

export function getBookmark(id: string): Bookmark | undefined {
  return store().items.find((bookmark) => bookmark.id === id);
}

export function updateBookmark(
  id: string,
  patch: Partial<Omit<Bookmark, "id">>,
): Bookmark | undefined {
  const bookmark = getBookmark(id);
  if (!bookmark) return undefined;
  Object.assign(bookmark, patch);
  return bookmark;
}

export function deleteBookmark(id: string): boolean {
  const items = store().items;
  const index = items.findIndex((bookmark) => bookmark.id === id);
  if (index === -1) return false;
  items.splice(index, 1);
  return true;
}
