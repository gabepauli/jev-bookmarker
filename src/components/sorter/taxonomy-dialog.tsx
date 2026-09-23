"use client";

import { useCallback, useRef, useState } from "react";
import { AlertDialog, Dialog, ScrollArea } from "radix-ui";

import { cn } from "@/lib/cn";
import {
  foldersMissingDescriptions,
  parseTaxonomyJson,
} from "@/lib/sorter/taxonomy-file";
import { uniqueFolderId } from "@/lib/sorter/taxonomy";
import type { TargetFolder } from "@/lib/sorter/types";

/**
 * Edits the folders Jev sorts into.
 *
 * The description is not decoration — it is the text the model actually reads, which is why it
 * gets a full textarea and says so. Changing one invalidates the suggestions that were made
 * against the old wording, so the caller offers a re-sort afterwards.
 */
export function TaxonomyDialog({
  open,
  folders,
  onSave,
  onOpenChange,
}: {
  open: boolean;
  folders: TargetFolder[];
  onSave: (folders: TargetFolder[]) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState<TargetFolder[]>(folders);
  const [pendingDelete, setPendingDelete] = useState<TargetFolder | undefined>();
  const [uploadError, setUploadError] = useState<string | undefined>();
  const [uploaded, setUploaded] = useState<{ name: string; count: number } | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  // Reopening should show what is in force now, not whatever was abandoned last time. Adjusting
  // during render rather than in an effect: React re-runs this component before committing, so
  // the dialog never paints the stale draft first.
  const [syncedTo, setSyncedTo] = useState(open);
  if (open !== syncedTo) {
    setSyncedTo(open);
    if (open) {
      setDraft(folders);
      setUploadError(undefined);
      setUploaded(undefined);
    }
  }

  const update = (id: string, patch: Partial<TargetFolder>) =>
    setDraft((current) =>
      current.map((folder) => (folder.id === id ? { ...folder, ...patch } : folder)),
    );

  const move = (index: number, delta: number) =>
    setDraft((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const addFolder = () =>
    setDraft((current) => [
      ...current,
      {
        id: uniqueFolderId("New folder", current),
        name: "New folder",
        description: "",
      },
    ]);

  const handleFile = useCallback(async (file: File) => {
    const result = parseTaxonomyJson(await file.text());
    if (!result.ok) {
      setUploadError(result.error);
      setUploaded(undefined);
      return;
    }
    // Replaces the draft, not the saved taxonomy. Cancel is still a real undo, and you get to
    // read what arrived — blank descriptions and all — before any of it takes effect.
    setDraft(result.folders);
    setUploadError(undefined);
    setUploaded({ name: file.name, count: result.folders.length });
  }, []);

  const valid = draft.length > 0 && draft.every((folder) => folder.name.trim().length > 0);
  const blank = foldersMissingDescriptions(draft).length;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-overlay bg-overlay/60 motion-safe:animate-[--animate-overlay-in]" />
        <Dialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-dialog w-[min(44rem,calc(100vw-2rem))]",
            "-translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-surface shadow-xl",
            "motion-safe:animate-[--animate-content-in]",
          )}
        >
          <div className="px-5 pt-5">
            <Dialog.Title className="text-lg font-medium text-balance">Edit folders</Dialog.Title>
            <Dialog.Description className="mt-1 max-w-prose text-sm text-muted text-pretty">
              Each description is the text Jev reads when deciding where a bookmark goes. Be
              concrete about what belongs in the folder — examples work better than a label.
            </Dialog.Description>
          </div>

          <ScrollArea.Root className="mt-4 h-[26rem] overflow-hidden">
            <ScrollArea.Viewport className="h-full w-full px-5">
              <ul className="space-y-3 pb-3">
                {draft.map((folder, index) => (
                  <li key={folder.id} className="border-t border-border pt-3">
                    <div className="flex items-start gap-2">
                      <input
                        value={folder.name}
                        onChange={(event) => update(folder.id, { name: event.target.value })}
                        aria-label={`Folder ${index + 1} name`}
                        className="min-w-0 flex-1 rounded-md border border-border-strong bg-background px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      />
                      <IconButton
                        label={`Move ${folder.name} up`}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        ↑
                      </IconButton>
                      <IconButton
                        label={`Move ${folder.name} down`}
                        disabled={index === draft.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        ↓
                      </IconButton>
                      <IconButton
                        label={`Delete ${folder.name}`}
                        onClick={() => setPendingDelete(folder)}
                      >
                        ✕
                      </IconButton>
                    </div>

                    <textarea
                      value={folder.description}
                      onChange={(event) =>
                        update(folder.id, { description: event.target.value })
                      }
                      rows={2}
                      aria-label={`What goes in ${folder.name}`}
                      placeholder="What goes in this folder?"
                      className="mt-2 w-full resize-y rounded-md border border-border-strong bg-background px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    />

                    {folder.drawsFrom && folder.drawsFrom.length > 0 && (
                      <p className="mt-1.5 text-xs text-muted text-pretty">
                        Mostly comes from: {folder.drawsFrom.join(", ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar
              orientation="vertical"
              className="flex w-2 touch-none p-0.5 select-none"
            >
              <ScrollArea.Thumb className="flex-1 rounded-full bg-border" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>

          <div className="border-t border-border px-5 py-3">
            {/* One slot, so an error and a confirmation never stack and push the buttons around. */}
            {uploadError ? (
              <p role="alert" className="mb-2.5 text-xs text-accent text-pretty">
                {uploadError}
              </p>
            ) : uploaded ? (
              <p role="status" className="mb-2.5 text-xs text-muted text-pretty">
                Loaded {uploaded.count} folder{uploaded.count === 1 ? "" : "s"} from{" "}
                {uploaded.name}. Nothing is saved until you press Save folders.
                {blank > 0 && (
                  <>
                    {" "}
                    {blank} {blank === 1 ? "has" : "have"} no description — that is the text Jev
                    reads when deciding.
                  </>
                )}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={addFolder}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-border/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Add folder
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-describedby="upload-json-hint"
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-border/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Upload JSON
              </button>
              <span id="upload-json-hint" className="sr-only">
                Replaces every folder in this list with the contents of the file. A list of objects
                with a name and a description.
              </span>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                aria-label="Folders JSON file"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFile(file);
                  // Reset so choosing the same file twice still fires a change.
                  event.target.value = "";
                }}
              />
              <div className="ml-auto flex items-center gap-2">
                <Dialog.Close className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-border/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                  Cancel
                </Dialog.Close>
                <button
                  type="button"
                  disabled={!valid}
                  aria-describedby={valid ? undefined : "save-folders-disabled"}
                  onClick={() => {
                    onSave(draft.map((folder) => ({ ...folder, name: folder.name.trim() })));
                    onOpenChange(false);
                  }}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
                >
                  Save folders
                </button>
                {!valid && (
                  <span id="save-folders-disabled" className="sr-only">
                    Every folder needs a name.
                  </span>
                )}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>

      <AlertDialog.Root
        open={pendingDelete !== undefined}
        onOpenChange={(next) => !next && setPendingDelete(undefined)}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-overlay bg-overlay/60" />
          <AlertDialog.Content
            className={cn(
              "fixed top-1/2 left-1/2 z-dialog w-[min(26rem,calc(100vw-2rem))]",
              "-translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-surface p-5 shadow-xl",
            )}
          >
            <AlertDialog.Title className="text-base font-medium text-balance">
              Delete “{pendingDelete?.name}”?
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-muted text-pretty">
              Bookmarks you placed here by hand move to the last folder in the list. Ones Jev put
              here go back to unsorted, and you can sort again.
            </AlertDialog.Description>
            <div className="mt-4 flex justify-end gap-2">
              <AlertDialog.Cancel className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-border/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                Keep it
              </AlertDialog.Cancel>
              <AlertDialog.Action
                onClick={() => {
                  setDraft((current) =>
                    current.filter((folder) => folder.id !== pendingDelete?.id),
                  );
                  setPendingDelete(undefined);
                }}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Delete folder
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </Dialog.Root>
  );
}

function IconButton({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="size-8 shrink-0 rounded-md border border-border text-sm text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}
