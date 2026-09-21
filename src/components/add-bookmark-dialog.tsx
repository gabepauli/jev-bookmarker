"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Dialog } from "radix-ui";

import { addBookmarkAction, type ActionState } from "@/app/actions";

function SubmitButton({ jevEnabled }: { jevEnabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? (jevEnabled ? "Asking Jev…" : "Saving…") : "Save bookmark"}
    </button>
  );
}

/**
 * Lives inside Dialog.Content, which Radix unmounts on close, so each time the dialog opens
 * the action state starts fresh and a previous error is not still on screen.
 */
function AddBookmarkForm({
  jevEnabled,
  onSaved,
}: {
  jevEnabled: boolean;
  onSaved: () => void;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const result = await addBookmarkAction(previous, formData);
      // Closing here rather than in an effect keeps it a direct consequence of the
      // submission instead of a cascading render.
      if (result.ok) onSaved();
      return result;
    },
    {},
  );

  return (
    <form action={formAction} className="mt-5 space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="url" className="block text-sm font-medium">
          URL
        </label>
        <input
          id="url"
          name="url"
          type="url"
          required
          autoFocus
          placeholder="https://example.com/article"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
        />
      </div>

      <details>
        <summary className="cursor-pointer text-sm text-muted hover:text-foreground">
          Override title and summary
        </summary>
        <div className="mt-3 space-y-3">
          <input
            name="title"
            type="text"
            placeholder="Title (fetched from the page if blank)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
          />
          <textarea
            name="excerpt"
            rows={3}
            placeholder="Summary — this is the text Jev evaluates"
            className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
          />
        </div>
      </details>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 pt-1">
        <Dialog.Close className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-border/40">
          Cancel
        </Dialog.Close>
        <SubmitButton jevEnabled={jevEnabled} />
      </div>
    </form>
  );
}

export function AddBookmarkDialog({ jevEnabled }: { jevEnabled: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
        Add bookmark
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] animate-overlay-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-6 shadow-2xl animate-content-in">
          <Dialog.Title className="text-lg font-semibold">
            Add a bookmark
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted">
            {jevEnabled
              ? "Paste a URL. Jev reads the page metadata and assigns a category, a reading priority, and a long-form flag."
              : "Paste a URL. Jev is not configured, so this will be saved unclassified."}
          </Dialog.Description>

          <AddBookmarkForm
            jevEnabled={jevEnabled}
            onSaved={() => setOpen(false)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
