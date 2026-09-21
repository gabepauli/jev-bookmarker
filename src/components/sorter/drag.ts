/**
 * Native HTML5 drag and drop, which needs no dependency but has two rules that are easy to miss.
 *
 * A custom MIME type is what lets a drop target recognise our payload and ignore a file or a
 * link dragged in from elsewhere. During `dragover` the browser's protected mode hides the
 * *value* but still exposes the *types*, so hover feedback has to check `types` and only `onDrop`
 * may read the id.
 *
 * Dragging is mouse-only, so it is strictly an accelerator here: every move it can make is also
 * available from the row's Move menu and its top-pick chips.
 */
export const DRAG_MIME = "application/x-jev-bookmark";

export function isBookmarkDrag(dataTransfer: DataTransfer | null): boolean {
  return dataTransfer?.types.includes(DRAG_MIME) ?? false;
}

export function readBookmarkId(dataTransfer: DataTransfer | null): string | undefined {
  const id = dataTransfer?.getData(DRAG_MIME);
  return id ? id : undefined;
}
