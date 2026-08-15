/**
 * Run the pipeline against one document from the command line.
 *
 *   npm run adapt -- --file brochure.md --title "Heart health" \
 *     --condition "Cardiovascular disease" --org "Northern Health" \
 *     --audience "Adults at raised CVD risk" [--profile cald-en-g5] [--yes]
 *
 *   npm run adapt -- --run <runId> --continue      resume after plan review
 *   npm run adapt -- --run <runId> --stage VERIFY  re-run one stage
 *
 * Without --yes it stops after stage 3 so you can inspect the change plan
 * before anything is rewritten.
 */

import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { prisma } from "../src/db";
import {
  createRun,
  createSourceDocument,
  runAfterPlan,
  runAll,
  runThroughPlan,
} from "../src/pipeline/run";
import {
  runAnalyse,
  runBackTranslate,
  runExtract,
  runPlan,
  runRewrite,
  runVerify,
} from "../src/pipeline/stages";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : "true";
}

const log = (message: string) => console.log(message);

async function main() {
  const runId = arg("run");
  const stage = arg("stage");

  if (runId && stage) {
    const stages: Record<string, (id: string) => Promise<unknown>> = {
      EXTRACT: runExtract,
      ANALYSE: runAnalyse,
      PLAN: runPlan,
      REWRITE: runRewrite,
      VERIFY: runVerify,
      BACKTRANSLATE: runBackTranslate,
    };
    const fn = stages[stage.toUpperCase()];
    if (!fn) throw new Error(`Unknown stage "${stage}". One of: ${Object.keys(stages).join(", ")}`);
    log(`Re-running ${stage.toUpperCase()} for run ${runId}`);
    await fn(runId);
    log("Done.");
    return;
  }

  if (runId && arg("continue")) {
    await prisma.changePlanItem.updateMany({
      where: { runId, status: "PROPOSED" },
      data: { status: "APPROVED" },
    });
    await runAfterPlan(runId, log);
    return;
  }

  const file = arg("file");
  if (!file) {
    console.error("Give me --file <path>, or --run <id> with --continue or --stage.");
    process.exit(1);
  }

  const sourceText = readFileSync(file, "utf8");
  const document = await createSourceDocument({
    title: arg("title") ?? basename(file),
    sourceText,
    condition: arg("condition") ?? "unspecified",
    sourceOrganisation: arg("org") ?? "unspecified",
    intendedAudience: arg("audience") ?? "unspecified",
    sourceFilename: basename(file),
    notes: arg("notes") ?? null,
  });
  log(`Source document ${document.id} (sha256 ${document.sourceSha256.slice(0, 12)}…)`);

  const run = await createRun({
    sourceDocumentId: document.id,
    profileKey: arg("profile") ?? "cald-en-g5",
  });
  log(`Run ${run.id}, version ${run.versionNumber}`);
  log("");

  if (arg("yes")) {
    await runAll(run.id, log);
  } else {
    await runThroughPlan(run.id, log);
    log("");
    log(`Inspect the plan, then: npm run adapt -- --run ${run.id} --continue`);
  }
}

main()
  .catch((err) => {
    console.error(`\n${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
