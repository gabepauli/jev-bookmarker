/**
 * Checks Jev's 16-way folder choice outside the app.
 *
 *   AI_GATEWAY_API_KEY=... npm run jev:folder-smoke
 *   AI_GATEWAY_API_KEY=... npm run jev:folder-smoke -- "<url>" "<title>"
 *
 * The open question this answers: a `choice` answer's `probabilities` is optional, and the app's
 * "N% sure" meter, its review threshold, and its top-picks chips all come from that
 * distribution. With sixteen criteria instead of five it may not come back at all. Run this
 * before trusting any of that UI — it prints the raw answer either way.
 */
import { gateway } from "@ai-sdk/gateway";
import { experimental_evaluate as evaluate } from "ai";

import {
  buildCriteria,
  DEFAULT_FOLDERS,
  FOLDER_QUESTION_INSTRUCTIONS,
} from "../src/lib/sorter/taxonomy";

const MODEL_ID = "typesafe-ai/jev";

/** Mirrors `classifyPlacement`'s state exactly — url and title, no previous folder. */
const SAMPLES = [
  {
    url: "https://www.nngroup.com/articles/user-story-mapping/",
    title: "Mapping User Stories in Agile",
  },
  {
    url: "https://uxdesign.cc/the-rainbow-sheet-a-visual-method-for-research-analysis-a7e7d2011058",
    title: "The rainbow sheet: a visual method for research analysis",
  },
  {
    url: "https://coolors.co/",
    title: "Coolors - The super fast color palettes generator!",
  },
];

async function main() {
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.error("AI_GATEWAY_API_KEY is not set.");
    process.exit(1);
  }

  const [url, title] = process.argv.slice(2);
  const samples = url && title ? [{ url, title }] : SAMPLES;

  const folders = [...DEFAULT_FOLDERS];
  const criteria = buildCriteria(folders);
  console.log(`Asking Jev to choose between ${Object.keys(criteria).length} folders.\n`);

  for (const state of samples) {
    const result = await evaluate({
      model: gateway.evaluation(MODEL_ID),
      state,
      questions: {
        folder: {
          type: "choice",
          instructions: FOLDER_QUESTION_INSTRUCTIONS,
          criteria,
        },
      },
    });

    const { choice, probabilities } = result.answers.folder;
    console.log(`${state.title}`);
    console.log(`  choice: ${choice}`);

    if (!probabilities) {
      // This is the case the UI has to survive: no meter, no chips, no threshold.
      console.log("  probabilities: NOT RETURNED — the app will show no confidence for this.");
    } else {
      const ranked = Object.entries(probabilities).sort((a, b) => b[1] - a[1]);
      console.log(`  confidence: ${(probabilities[choice] * 100).toFixed(1)}%`);
      console.log(
        `  top picks: ${ranked
          .slice(0, 3)
          .map(([id, p]) => `${id} ${(p * 100).toFixed(0)}%`)
          .join(", ")}`,
      );
      console.log(`  entries in distribution: ${ranked.length}`);
    }

    console.log(`  resolved modelId: ${result.response.modelId}`);
    if (result.warnings.length > 0) console.log("  warnings:", result.warnings);
    console.log();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
