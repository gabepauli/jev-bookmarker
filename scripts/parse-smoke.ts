/**
 * Parses a real bookmarks export and prints what came out, without the app.
 *
 *     npx tsx scripts/parse-smoke.ts ~/Downloads/bookmarks.html
 *     npx tsx scripts/parse-smoke.ts ~/Downloads/bookmarks.html "UX Links"
 *
 * `parseNetscapeHtml` needs a DOM, and Node has none. Rather than add a second HTML parser that
 * would drift from the one we ship on, this bundles the real module and runs it inside headless
 * Chromium — the same engine the app uses. Set CHROME_PATH if it is not found automatically.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import * as esbuild from "esbuild";

const run = promisify(execFile);

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.PLAYWRIGHT_BROWSERS_PATH
    ? path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, "chromium", "chrome-linux", "chrome")
    : undefined,
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

function findChrome(): string {
  for (const candidate of CHROME_CANDIDATES) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  throw new Error(
    "No Chromium found. Set CHROME_PATH to a Chrome or Chromium binary and try again.",
  );
}

type Report = {
  totalLinks: number;
  totalFolders: number;
  topFolders: { label: string; totalLinks: number }[];
  scoped?: {
    label: string;
    kept: number;
    totalParsed: number;
    duplicates: { title: string }[];
    portuguese: number;
    originalFolders: number;
    sample: { title: string; originalFolder: string; pt: boolean }[];
  };
};

async function main(): Promise<void> {
  const [file, sourceName] = process.argv.slice(2);
  if (!file) {
    console.error("Usage: tsx scripts/parse-smoke.ts <bookmarks.html> [source folder name]");
    process.exitCode = 1;
    return;
  }

  const html = await readFile(file, "utf8");
  console.log(`Read ${file} — ${(html.length / 1024).toFixed(0)} KB`);

  const bundle = await esbuild.build({
    entryPoints: [path.resolve("src/lib/sorter/netscape.ts")],
    bundle: true,
    write: false,
    format: "iife",
    globalName: "Netscape",
    platform: "browser",
    target: "es2022",
    tsconfig: path.resolve("tsconfig.json"),
  });
  const code = bundle.outputFiles[0].text;

  const dir = await mkdtemp(path.join(tmpdir(), "parse-smoke-"));
  const harness = path.join(dir, "harness.html");

  await writeFile(
    harness,
    [
      "<!doctype html><meta charset='utf-8'><body><pre id='out'></pre>",
      `<script id="src" type="application/json">${JSON.stringify(html).replace(/</g, "\\u003c")}</script>`,
      "<script>",
      code,
      `const SOURCE = ${JSON.stringify(sourceName ?? null)};`,
      HARNESS_MAIN,
      "</script>",
    ].join("\n"),
    "utf8",
  );

  const chrome = findChrome();
  const { stdout } = await run(
    chrome,
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--dump-dom",
      `file://${harness}`,
    ],
    { maxBuffer: 64 * 1024 * 1024 },
  );

  const match = stdout.match(/<pre id="out">([\s\S]*?)<\/pre>/);
  if (!match) throw new Error("Harness produced no output. Is Chromium working?");

  const report = JSON.parse(
    match[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&"),
  ) as Report & { error?: string };

  if (report.error) throw new Error(report.error);

  console.log(`\n${report.totalLinks} links across ${report.totalFolders} folders`);
  console.log("\nTop-level folders:");
  for (const folder of report.topFolders) {
    console.log(`  ${String(folder.totalLinks).padStart(5)}  ${folder.label}`);
  }

  if (report.scoped) {
    const s = report.scoped;
    console.log(`\nScoped to "${s.label}":`);
    console.log(`  ${s.totalParsed} links in ${s.originalFolders} source folders`);
    console.log(`  ${s.kept} kept, ${s.duplicates.length} duplicate(s) removed`);
    for (const duplicate of s.duplicates) console.log(`      dup: ${duplicate.title}`);
    console.log(`  ${s.portuguese} detected as Portuguese`);
    console.log("\n  First few:");
    for (const item of s.sample) {
      console.log(`    ${item.pt ? "PT" : "  "}  ${item.originalFolder.padEnd(28)}  ${item.title}`);
    }
  }
}

/** Runs inside the page, where DOMParser exists. */
const HARNESS_MAIN = `
try {
  const html = JSON.parse(document.getElementById("src").textContent);
  const parsed = Netscape.parseNetscapeHtml(html);
  const report = {
    totalLinks: parsed.bookmarks.length,
    totalFolders: parsed.folders.length,
    topFolders: parsed.folders
      .filter((f) => f.depth === 2)
      .map((f) => ({ label: f.label, totalLinks: f.totalLinks })),
  };
  if (SOURCE) {
    const source = parsed.folders.find((f) => f.label.includes(SOURCE));
    if (!source) throw new Error("No folder matching " + SOURCE);
    const scoped = Netscape.scopeToFolder(parsed, source);
    report.scoped = {
      label: source.label,
      kept: scoped.bookmarks.length,
      totalParsed: scoped.totalParsed,
      duplicates: scoped.duplicates.map((d) => ({ title: d.title })),
      portuguese: scoped.bookmarks.filter((b) => b.isPortuguese).length,
      originalFolders: new Set(scoped.bookmarks.map((b) => b.originalFolder)).size,
      sample: scoped.bookmarks.slice(0, 8).map((b) => ({
        title: b.title.slice(0, 60),
        originalFolder: b.originalFolder,
        pt: b.isPortuguese,
      })),
    };
  }
  document.getElementById("out").textContent = JSON.stringify(report);
} catch (error) {
  document.getElementById("out").textContent = JSON.stringify({ error: String(error) });
}
`;

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
