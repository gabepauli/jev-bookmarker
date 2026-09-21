"use client";

import { useCallback, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { parseNetscapeHtml } from "@/lib/sorter/netscape";
import type { ParsedBookmark, SourceFolder } from "@/lib/sorter/types";

export type ParsedFile = {
  bookmarks: Omit<ParsedBookmark, "originalFolder" | "isPortuguese">[];
  folders: SourceFolder[];
};

/**
 * The empty state: get a bookmarks file in.
 *
 * Parsing happens here, in the browser. A full Chrome export is most of a megabyte, almost all of
 * it base64 favicons, and there is no reason for any of it to reach a server.
 */
export function ImportStep({
  onParsed,
  onError,
  error,
}: {
  onParsed: (parsed: ParsedFile) => void;
  onError: (message: string) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setReading(true);
      try {
        const parsed = parseNetscapeHtml(await file.text());
        if (parsed.bookmarks.length === 0) {
          onError(
            "No bookmarks found in that file. Export from your browser's bookmark manager and try again.",
          );
          return;
        }
        onParsed(parsed);
      } catch (cause) {
        onError(
          cause instanceof Error ? cause.message : "That file could not be read.",
        );
      } finally {
        setReading(false);
      }
    },
    [onParsed, onError],
  );

  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <h1 className="text-2xl font-semibold text-balance">Sort your bookmarks</h1>
      <p className="mx-auto mt-2 max-w-prose text-sm text-muted text-pretty">
        Import a bookmarks file, pick the folder you want cleaned up, and Jev files every link
        into a folder you chose. You review the ones it was unsure about, then export.
      </p>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file) void handleFile(file);
        }}
        className={cn(
          "mt-8 rounded-xl border border-dashed border-border bg-surface px-6 py-12",
          dragging && "border-accent bg-border/30",
        )}
      >
        <p className="text-sm text-muted">Drop a bookmarks file here</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={reading}
          className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
        >
          {reading ? "Reading file…" : "Choose a file"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".html,.htm,text/html"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            // Reset so choosing the same file twice still fires a change.
            event.target.value = "";
          }}
        />
        <p className="mt-4 text-xs text-muted text-pretty">
          In Chrome: Bookmarks → Bookmark manager → ⋮ → Export bookmarks.
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-warn text-pretty">
          {error}
        </p>
      )}
    </div>
  );
}

/** Folders worth offering as a sort target — anything with enough in it to be worth the trip. */
export function pickableFolders(folders: SourceFolder[]): SourceFolder[] {
  return folders
    .filter((folder) => folder.totalLinks > 0)
    .sort((a, b) => b.totalLinks - a.totalLinks);
}
