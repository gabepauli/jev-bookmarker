# Jev Bookmarker

Save a link; [Jev](https://vercel.com/ai-gateway/models/jev) categorizes it, scores how worth
reading it is, and flags whether it's a long read.

Next.js 16 (App Router) · React 19 · Radix primitives · Tailwind v4 · AI SDK 7

## Quick start

```bash
npm install
cp .env.example .env.local   # optional — see below
npm run dev
```

The app runs **without** any credential. Bookmarks save as *unclassified* and the UI says so.
Add a key to turn classification on.

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
a probability. `src/lib/jev.ts` asks all three in a single round trip:

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

Classification never blocks a save. A missing key, a gateway error, or a timeout leaves the
bookmark unclassified with the reason shown on the card, and "Re-run Jev" retries it.

## Project layout

```
src/lib/jev.ts          Jev questions + evaluate() wrapper
src/lib/bookmarks.ts    in-memory store (swap this one file for a database)
src/lib/metadata.ts     best-effort <title>/description fetch
src/lib/types.ts        shared types + score normalization
src/app/actions.ts      server actions: add, re-classify, delete
src/components/         Radix primitives styled with Tailwind
scripts/jev-smoke.ts    standalone gateway check
```

### Storage

Bookmarks live in process memory, seeded on first load and pinned to `globalThis` so dev-mode
hot reload doesn't wipe them. They **do not survive a restart**, and on serverless each
invocation may get a fresh process. Replace `src/lib/bookmarks.ts` with a real database when
you need persistence; nothing else imports the store directly.

## Vercel MCP

`.mcp.json` registers Vercel's hosted MCP server, which lets Claude Code search Vercel docs and
inspect your projects, deployments, and logs.

```json
{ "mcpServers": { "vercel": { "type": "http", "url": "https://mcp.vercel.com" } } }
```

The server is OAuth-protected, and consent happens in a browser. Run **`/mcp`** in Claude Code
and authorize `vercel` before the authenticated tools work; until then only the public
documentation tools are available.
