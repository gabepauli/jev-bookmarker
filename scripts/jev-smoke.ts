/**
 * Standalone check that the gateway credential works and Jev answers, with no Next.js or UI
 * in the way.
 *
 *   AI_GATEWAY_API_KEY=... npx tsx scripts/jev-smoke.ts [url]
 */
import { gateway } from "@ai-sdk/gateway";
import { experimental_evaluate as evaluate } from "ai";

const MODEL_ID = "typesafe-ai/jev";

async function main() {
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.error("AI_GATEWAY_API_KEY is not set.");
    process.exit(1);
  }

  const url = process.argv[2] ?? "https://arxiv.org/abs/1706.03762";

  const result = await evaluate({
    model: gateway.evaluation(MODEL_ID),
    state: {
      url,
      title: "Attention Is All You Need",
      excerpt:
        "Introduces the Transformer, a network architecture based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.",
    },
    questions: {
      category: {
        type: "choice",
        instructions: "Which single category best describes this bookmark?",
        criteria: {
          engineering: "Programming, infrastructure, developer tooling.",
          design: "User interface, user experience, or visual design.",
          business: "Startups, finance, strategy, marketing.",
          science: "Research papers, hard science, mathematics.",
          other: "Fits none of the other categories.",
        },
      },
      readingPriority: {
        type: "score",
        instructions: "How worth reading soon is this for a working software engineer?",
        criteria: ["Skip it", "Low priority", "Worth reading this week", "Read it now"],
      },
      isLongForm: {
        type: "boolean",
        instructions: "Is this long-form reading, over roughly ten minutes?",
      },
    },
  });

  console.log("answers:", JSON.stringify(result.answers, null, 2));
  console.log("usage:", result.usage);
  // The gateway resolves `typesafe-ai/jev` to a concrete version; this is which one you got.
  console.log("resolved modelId:", result.response.modelId);
  if (result.warnings.length > 0) console.log("warnings:", result.warnings);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
