#!/usr/bin/env node

import dotenv from "dotenv";
import { readClaims, writeClaims, validateFilePath } from "./fileUtils.js";
import { createLLMClient, LLMClient } from "./llmClient.js";
import { ClaimInput, ClaimOutput } from "./types.js";

dotenv.config();

/**
 * Displays usage information
 */
function showUsage(): void {
  // TODO: Display usage instructions
  // Show how to run the CLI with input/output file arguments
  // Mention required OPENROUTER_API_KEY environment variable
}

/**
 * Parses and validates command line arguments
 */
function parseArguments(): { inputPath: string; outputPath: string } {
  try {
    const args = process.argv.slice(2);

    if (args.length !== 2) {
      showUsage();
      process.exit(1);
    }

    const [inputArg, outputArg] = args;

    const inputPath = validateFilePath(inputArg, "json");
    const outputPath = validateFilePath(outputArg, "json");

    return { inputPath, outputPath };
  } catch (error) {
    showUsage();
    process.exit(1);
  }
}

/**
 * Processes claims with progress reporting
 */
async function processClaims(
  claims: ClaimInput[],
  llmClient: LLMClient
): Promise<ClaimOutput[]> {
  const results: ClaimOutput[] = [];
  let processed = 0;
  const total = claims.length;

  for (const claim of claims) {
    try {
      const output = await llmClient.classifyDenial(claim);
      results.push(output);
    } catch (error: any) {
      // Push a placeholder with error info for failed claims
      results.push({
        ...claim,
        categories: [],
        extracted_fields: {},
        error: error?.message || String(error),
      } as any); // 'as any' to allow error field, will be filtered in summary
    }
    processed++;
    // Show progress
    const percent = ((processed / total) * 100).toFixed(1);
    process.stdout.write(
      `\rProcessing claims: ${processed}/${total} (${percent}%)`
    );
    // Rate limiting: 500ms delay between API calls
    if (processed < total) {
      await new Promise((res) => setTimeout(res, 500));
    }
  }
  process.stdout.write("\n");
  return results;
}

/**
 * Shows a summary of processing results
 */
function showSummary(claims: ClaimOutput[]): void {
  const total = claims.length;
  const successful = claims.filter((claim) => !claim.error).length;
  const failed = total - successful;

  // Count categories
  const categoryCounts: Record<string, number> = {};
  claims.forEach((claim) => {
    if (!claim.error && claim.categories) {
      claim.categories.forEach((category) => {
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      });
    }
  });

  // Count payers
  const payerCounts: Record<string, number> = {};
  claims.forEach((claim) => {
    if (!claim.error && claim.extracted_fields?.payer) {
      const payer = claim.extracted_fields.payer;
      payerCounts[payer] = (payerCounts[payer] || 0) + 1;
    }
  });

  console.log("\n📊 Processing Summary");
  console.log("=".repeat(50));
  console.log(`Total Claims: ${total}`);
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);

  if (Object.keys(categoryCounts).length > 0) {
    console.log("\n📋 Categories Found:");
    Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`  • ${category}: ${count}`);
      });
  }

  if (Object.keys(payerCounts).length > 0) {
    console.log("\n🏥 Payers Identified:");
    Object.entries(payerCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([payer, count]) => {
        console.log(`  • ${payer}: ${count}`);
      });
  }

  if (failed > 0) {
    console.log("\n⚠️  Failed Claims:");
    claims
      .filter((claim) => claim.error)
      .forEach((claim) => {
        console.log(`  • Claim ${claim.id}: ${claim.error}`);
      });
  }

  console.log("\n✨ Processing complete!");
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    console.log("🩺 Medical Claim Denial Classifier (OpenRouter LLM)\n");

    const { inputPath, outputPath } = parseArguments();

    const llmClient = createLLMClient();

    const claims = await readClaims(inputPath);

    console.log(`Processing ${claims.length} claim(s)...`);
    const processedClaims = await processClaims(claims, llmClient);

    await writeClaims(outputPath, processedClaims);

    showSummary(processedClaims);
  } catch (error: any) {
    console.error(`\n💥 Error: ${error.message || error}`);
    process.exit(1);
  }
}

process.on("uncaughtException", (error) => {
  console.error("\n💥 Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("\n💥 Unhandled rejection at:", promise, "reason:", reason);
  process.exit(1);
});

process.on("SIGINT", () => {
  console.log("\n\n⏹️  Process interrupted by user");
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
