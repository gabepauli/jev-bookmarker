"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import { ClassifyProgress } from "@/components/sorter/classify-progress";
import { FolderSection } from "@/components/sorter/folder-section";
import { FolderSidebar } from "@/components/sorter/folder-sidebar";
import { ImportStep, type ParsedFile, pickableFolders } from "@/components/sorter/import-step";
import { SorterHeader } from "@/components/sorter/sorter-header";
import { SorterToolbar } from "@/components/sorter/sorter-toolbar";
import { SourceFolderDialog } from "@/components/sorter/source-folder-dialog";
import { TaxonomyDialog } from "@/components/sorter/taxonomy-dialog";
import { classifyBookmarks } from "@/lib/sorter/classify-client";
import { downloadExport } from "@/lib/sorter/export";
import { scopeToFolder } from "@/lib/sorter/netscape";
import { clearSession, loadSession, saveSessionSoon } from "@/lib/sorter/persistence";
import {
  folderCounts,
  groupByFolder,
  initialSession,
  needsLook,
  sorterReducer,
  suggestionsAreStale,
  UNSORTED_ID,
} from "@/lib/sorter/session";
import type { ParsedBookmark, SourceFolder, TargetFolder } from "@/lib/sorter/types";

/**
 * The sorter.
 *
 * Owns the whole session: the reducer, its persistence, and the classification run. Everything
 * below it is presentational, which is what keeps a few hundred rows cheap to re-render.
 */
export function SorterApp({
  jevConfigured,
  modelId,
}: {
  jevConfigured: boolean;
  modelId: string;
}) {
  const [session, dispatch] = useReducer(sorterReducer, undefined, initialSession);
  const [parsed, setParsed] = useState<ParsedFile | undefined>();
  const [importError, setImportError] = useState<string | undefined>();
  const [editingFolders, setEditingFolders] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const cancelled = useRef(false);

  // Storage is read after mount, never during render: reading it while rendering would make the
  // server and client trees disagree and break hydration. One dispatch either way, so the
  // hydrated flag rides along with the restored session instead of being a second update.
  useEffect(() => {
    dispatch({ type: "session/restored", session: loadSession() });
  }, []);

  useEffect(() => {
    if (session.hydrated) saveSessionSoon(session);
  }, [session]);

  const runClassification = useCallback(
    async (bookmarks: ParsedBookmark[], folders: TargetFolder[]) => {
      if (bookmarks.length === 0) return;
      cancelled.current = false;
      dispatch({ type: "classify/started", total: bookmarks.length });

      await classifyBookmarks(bookmarks, folders, jevConfigured, {
        onBatch: (results, mode) => dispatch({ type: "classify/resolved", results, mode }),
        isCancelled: () => cancelled.current,
      });

      dispatch({ type: "classify/finished" });
    },
    [jevConfigured],
  );

  const handlePickSource = useCallback(
    (source: SourceFolder) => {
      if (!parsed) return;
      const result = scopeToFolder(parsed, source);
      setParsed(undefined);
      dispatch({ type: "session/imported", result, source });
      void runClassification(result.bookmarks, session.folders);
    },
    [parsed, runClassification, session.folders],
  );

  const handleAssign = useCallback((id: string, folderId: string) => {
    dispatch({ type: "item/assigned", id, folderId });
  }, []);

  const handleDrop = useCallback(
    (id: string, folderId: string) => {
      dispatch({ type: "item/assigned", id, folderId });
      const name = session.folders.find((folder) => folder.id === folderId)?.name;
      // Drag and drop gives no feedback to a screen reader on its own.
      if (name) setAnnouncement(`Moved to ${name}.`);
    },
    [session.folders],
  );

  const handleRetry = useCallback(
    (id: string) => {
      const bookmark = session.bookmarks.find((candidate) => candidate.id === id);
      if (bookmark) void runClassification([bookmark], session.folders);
    },
    [runClassification, session.bookmarks, session.folders],
  );

  const handleStartOver = useCallback(() => {
    clearSession();
    dispatch({ type: "session/cleared" });
    setParsed(undefined);
  }, []);

  const handleSaveFolders = useCallback((folders: TargetFolder[]) => {
    dispatch({ type: "folders/changed", folders });
  }, []);

  // Dragging the threshold re-partitions every row; deferring keeps the thumb smooth.
  const threshold = useDeferredValue(session.threshold);

  const groups = useMemo(
    () => groupByFolder(session.bookmarks, session.items, session.folders),
    [session.bookmarks, session.items, session.folders],
  );
  const counts = useMemo(
    () => folderCounts(session.bookmarks, session.items, threshold),
    [session.bookmarks, session.items, threshold],
  );

  const needsLookCount = useMemo(
    () =>
      session.bookmarks.filter((bookmark) => needsLook(session.items[bookmark.id], threshold))
        .length,
    [session.bookmarks, session.items, threshold],
  );
  const stale = useMemo(() => suggestionsAreStale(session), [session]);

  if (!session.hydrated) return null;

  if (session.bookmarks.length === 0) {
    const folders = parsed ? pickableFolders(parsed.folders) : [];
    return (
      <>
        <ImportStep onParsed={setParsed} onError={setImportError} error={importError} />
        <SourceFolderDialog
          open={parsed !== undefined}
          folders={folders}
          totalLinks={parsed?.bookmarks.length ?? 0}
          onPick={handlePickSource}
          onCancel={() => setParsed(undefined)}
        />
      </>
    );
  }

  const unsorted = groups.get(UNSORTED_ID) ?? [];
  const visible = (bookmarks: ParsedBookmark[]) =>
    session.tab === "needs-look"
      ? bookmarks.filter((bookmark) => needsLook(session.items[bookmark.id], threshold))
      : bookmarks;

  return (
    <div className="space-y-6">
      <SorterHeader session={session} modelId={modelId} onStartOver={handleStartOver} />

      {stale && (
        <div className="flex flex-wrap items-center gap-3 border-l-2 border-accent pl-3">
          <p className="text-sm text-pretty">
            The folders changed, so what Jev suggested no longer matches them. Your own moves are
            kept.
          </p>
          <button
            type="button"
            onClick={() => void runClassification(session.bookmarks, session.folders)}
            className="ml-auto rounded-md border border-border px-3 py-1.5 text-sm hover:bg-border/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Sort again
          </button>
        </div>
      )}

      <SorterToolbar
        tab={session.tab}
        onTabChange={(tab) => dispatch({ type: "tab/changed", tab })}
        totalCount={session.bookmarks.length}
        needsLookCount={needsLookCount}
        threshold={session.threshold}
        onThresholdChange={(value) => dispatch({ type: "threshold/changed", value })}
        onExport={() => downloadExport(session)}
        onEditFolders={() => setEditingFolders(true)}
        canExport={session.status !== "classifying"}
      />

      {session.status === "classifying" && (
        <ClassifyProgress
          done={session.progress.done}
          total={session.progress.total}
          failed={session.progress.failed}
          onCancel={() => {
            cancelled.current = true;
            dispatch({ type: "classify/finished" });
          }}
        />
      )}

      <div className="grid gap-6 sm:grid-cols-[14rem_minmax(0,1fr)]">
        <FolderSidebar
          folders={session.folders}
          counts={counts}
          unsortedCount={unsorted.length}
          onDropBookmark={handleDrop}
        />

        <div className="min-w-0 space-y-10">
          {session.folders.map((folder) => {
            const bookmarks = visible(groups.get(folder.id) ?? []);
            if (bookmarks.length === 0) return null;
            return (
              <FolderSection
                key={folder.id}
                id={folder.id}
                name={folder.name}
                description={folder.description}
                bookmarks={bookmarks}
                items={session.items}
                folders={session.folders}
                threshold={threshold}
                onAssign={handleAssign}
                onRetry={handleRetry}
                needsLook={needsLook}
              />
            );
          })}

          {visible(unsorted).length > 0 && (
            <FolderSection
              id={UNSORTED_ID}
              name="Not sorted yet"
              bookmarks={visible(unsorted)}
              items={session.items}
              folders={session.folders}
              threshold={threshold}
              onAssign={handleAssign}
              onRetry={handleRetry}
              needsLook={needsLook}
            />
          )}

          {session.tab === "needs-look" && needsLookCount === 0 && (
            <p className="py-10 text-center text-sm text-muted text-pretty">
              Nothing needs a look at {Math.round(threshold * 100)}%. Raise the threshold to
              review more, or export the file.
            </p>
          )}
        </div>
      </div>

      <TaxonomyDialog
        open={editingFolders}
        folders={session.folders}
        onSave={handleSaveFolders}
        onOpenChange={setEditingFolders}
      />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
