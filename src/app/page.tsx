import { AddBookmarkDialog } from "@/components/add-bookmark-dialog";
import { BookmarkList } from "@/components/bookmark-list";
import { listBookmarks } from "@/lib/bookmarks";
import { isJevConfigured, JEV_MODEL_ID } from "@/lib/jev";

// The store lives in process memory, so this page must not be prerendered at build time.
export const dynamic = "force-dynamic";

export default function Home() {
  const bookmarks = listBookmarks();
  const jevEnabled = isJevConfigured();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jev Bookmarker</h1>
          <p className="mt-1 text-sm text-muted">
            Save a link and{" "}
            <code className="rounded bg-border/60 px-1 py-0.5 font-mono text-xs">
              {JEV_MODEL_ID}
            </code>{" "}
            categorizes it, scores how worth reading it is, and flags long reads.
          </p>
        </div>
        <AddBookmarkDialog jevEnabled={jevEnabled} />
      </header>

      {jevEnabled ? null : (
        <p className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <strong className="font-medium">Jev is not configured.</strong> Set{" "}
          <code className="font-mono text-xs">AI_GATEWAY_API_KEY</code> in{" "}
          <code className="font-mono text-xs">.env.local</code> to turn on classification.
          Bookmarks still save without it.
        </p>
      )}

      <BookmarkList bookmarks={bookmarks} />
    </main>
  );
}
