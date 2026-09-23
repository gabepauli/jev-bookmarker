# Jev Bookmarker

Point [Jev](https://vercel.com/ai-gateway/models/jev) at a browser bookmarks export and it files
every link into folders you defined. You review what it was unsure about and export a clean file.

Next.js 16 (App Router) · React 19 · Radix primitives · Tailwind v4 · AI SDK 7

| Route | What it is |
|---|---|
| `/` | The sorter: import a bookmarks file, sort it in bulk, export the result. |
| `/inbox` | The original single-bookmark demo — paste a URL, see Jev's raw answers. |

## Quick start

```bash
npm install
cp .env.example .env.local   # optional — see below
npm run dev
```

The app runs **without** any credential. With no key it sorts using a local stand-in and says so
on screen; nothing leaves the browser. Add a key to hand the work to Jev.

## Sorting bookmarks

Export from your browser (in Chrome: Bookmarks → Bookmark manager → ⋮ → Export bookmarks), then
drop the file on `/`.

1. **Pick one folder to sort.** An export is the whole bookmark bar. Sorting is scoped to one
   subtree; everything else in the file is left alone.
2. **Press Sort.** Nothing is sent anywhere until you do — importing lands every bookmark
   unsorted and waits. Stop mid-run and the button offers the remainder rather than starting
   over. The panel reports what the run cost: wall time, and the average Jev spent per bookmark.
3. **Jev files each link** into one of the target folders. It sees the URL and the title — no
   page is fetched, and the folder the bookmark came from is deliberately not sent: a tree worth
   re-sorting is usually one whose folder names are noise, and a hint that agrees with a thin
   title mostly inflates confidence past the point where you would have been asked.
4. **Review.** Anything Jev was less sure about than your threshold is highlighted and listed
   under *Needs a look*, with its runners-up one click away. Drag a row onto a folder, use its
   Move menu, or click a top pick. Your moves always win and survive re-sorting.
5. **Export.** You get a standalone bookmarks file: one folder holding your target folders, ready
   to import back into the browser.

**Edit folders** changes the taxonomy. The description is not a label — it is the text Jev reads
when deciding, so be concrete about what belongs there. Changing one retires the suggestions made
against the old wording and offers a re-sort; your manual moves are never discarded.

**Upload JSON**, in the same dialog, replaces the whole list from a file — a list of objects with
a `name` and a `description`, up to forty of them:

```json
[
  { "name": "Accessibility", "description": "WCAG, ARIA, screen readers, inclusive language." },
  { "name": "Learning", "description": "Courses, study guides, blogs and publications." }
]
```

An optional `"id"` per folder is what makes a file re-uploadable without cost: ids are the
identity cached suggestions are filed under, so a file that keeps them keeps its history, while
one that omits them slugifies fresh ids and starts over. Nothing is saved until you press
*Save folders*, so a file you did not mean to load is a Cancel away.

Two target folders are routing decisions rather than topics — *Move to UI Links* and *Not design*
— and are written beside the sorted folder rather than inside it. That pair is specific to the
default taxonomy; an uploaded one nests everything inside the sorted folder.

Bookmarks in other languages are filed by topic like everything else. A `PT` badge on the row
tells you what you are looking at, and the summary line counts them, but language never changes
where something lands.

### What it does to your data

Parsing happens in the browser and the file is never uploaded; only a URL, a title, and a folder
name per bookmark are sent, and only when a gateway key is set. The session lives in
`localStorage`, so a reload picks up where you left off. Favicons are dropped on import, which is
about 83% of a typical export's bytes. Duplicate URLs are merged, and the summary line names every
title it dropped so a merge is never silent.

### Checking the import without the UI

```bash
npm run parse:smoke -- ~/Downloads/bookmarks.html "UX Links"
```

Prints the folder tree with counts, the duplicates, and the Portuguese count. Node has no DOM, so
this bundles the real parser and runs it in headless Chromium rather than using a second HTML
parser that would drift from the one the app ships. Set `CHROME_PATH` if it cannot find a browser.

## Getting a gateway key

`AI_GATEWAY_API_KEY` comes from the Vercel dashboard under **AI Gateway → API keys**. Put it in
`.env.local`. When deploying on Vercel, the gateway can authenticate via OIDC instead, in which
case no explicit key is needed.

Verify it independently of the UI:

```bash
npm run jev:smoke
```

That prints Jev's raw answers, token usage, and the concrete model version the gateway resolved
`typesafe-ai/jev` to.

## How the Jev integration works

Jev is an **evaluation** model, not a text model. There is no prompt and no response to parse:
you hand it one shared state plus typed questions, and each comes back as a choice, a score, or
a probability. `src/lib/jev.ts` holds two calls.

`classifyPlacement` is what the sorter uses — one `choice` question over your target folders:

| Question | Type | Returns |
|---|---|---|
| `folder` | `choice` | Which of your folders this bookmark belongs in |

`classifyBookmark` is what `/inbox` uses, asking all three question types in a single round trip:

| Question | Type | Returns |
|---|---|---|
| `category` | `choice` | One of engineering / design / business / science / other |
| `readingPriority` | `score` | Fractional position across four ordered levels |
| `isLongForm` | `boolean` | P(true) that this is a long read |

Three things about the result shape are easy to get wrong:

- **`score` is not 0–1.** It is a fractional position in `[0, criteria.length - 1]` — here
  `[0, 3]`. `priorityFraction()` in `src/lib/types.ts` normalizes it for display.
- **`boolean` returns a probability, not a bool.** It is the model's estimated P(true), not a
  confidence in either outcome, so it needs an explicit threshold. This app uses 0.5.
- **`probabilities` is optional** on choice and score answers. Always guard before reading it.
  The sorter's confidence meter, its review threshold and its top-pick chips all read from that
  distribution, so every one of them renders an explicit "no distribution" state rather than a
  `NaN%`. Check what your model actually returns before relying on it:

  ```bash
  npm run jev:folder-smoke
  ```

One more trap is specific to the sorter. Because the folders are editable, its `criteria` object
is built at runtime, which costs the literal-type narrowing `classifyBookmark` enjoys —
`answers.folder.choice` comes back as a plain `string`. It is validated against the live taxonomy
on every response before it is trusted.

Classification never blocks a save. A missing key, a gateway error, or a timeout leaves the
bookmark unclassified with the reason shown on the card, and "Re-run Jev" retries it. In the
sorter, a failure is isolated to its own bookmark — one bad URL never costs a batch — and the row
offers a Retry.

## Project layout

```
src/lib/jev.ts               Jev questions + evaluate() wrappers (server-only)
src/lib/sorter/              the bulk sorter's domain logic, all client-safe:
  netscape.ts                  parse and write Netscape bookmark HTML
  taxonomy.ts                  the default target folders + Jev's criteria
  sample-classifier.ts         the local stand-in used when no key is set
  session.ts                   reducer + selectors
  classify-client.ts           batching, caching, progress
  export.ts                    grouping and download
src/app/sort-actions.ts      the one server action the sorter calls
src/app/actions.ts           /inbox server actions: add, re-classify, delete
src/components/sorter/       the sorter screen
scripts/parse-smoke.ts       parse a real export without the app
scripts/jev-folder-smoke.ts  check the 16-way folder choice
```

### Storage

The sorter keeps its session in `localStorage` and never touches the server store.

`/inbox`'s bookmarks live in process memory, seeded on first load and pinned to `globalThis` so
dev-mode hot reload doesn't wipe them. They **do not survive a restart**, and on serverless each
invocation may get a fresh process. Replace `src/lib/bookmarks.ts` with a real database when you
need persistence; nothing else imports the store directly.

## UI skills

`.claude/skills/` carries the [UI Skills](https://ui-skills.com) set, vendored from the npm
package so it works offline. `/baseline-ui` and `/fixing-accessibility` are the two worth running
against any change to `src/components/`.

## Vercel MCP

`.mcp.json` registers Vercel's hosted MCP server, which lets Claude Code search Vercel docs and
inspect your projects, deployments, and logs.

```json
{ "mcpServers": { "vercel": { "type": "http", "url": "https://mcp.vercel.com" } } }
```

The server is OAuth-protected, and consent happens in a browser. Run **`/mcp`** in Claude Code
and authorize `vercel` before the authenticated tools work; until then only the public
documentation tools are available.
