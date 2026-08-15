import { prisma } from "../db";
import { sha256 } from "../llm";
import { loadMethod } from "../method/loader";
import type { LoadedMethod } from "../method/types";
import { profileFromManifest } from "../method/render";
import {
  runAnalyse,
  runBackTranslate,
  runExtract,
  runPlan,
  runRewrite,
  runVerify,
} from "./stages";

/**
 * Creating runs and driving them through the stages. The orchestration is
 * deliberately dumb: a short list of awaits with a hard stop at plan review.
 * Anything cleverer would make the pipeline harder to reason about than the
 * documents it produces.
 */

/** Copy the profiles in method.yaml into the database. Idempotent. */
export async function syncProfiles(method: LoadedMethod = loadMethod()): Promise<number> {
  for (const profile of method.manifest.profiles) {
    const data = {
      label: profile.label,
      language: profile.language,
      translate: profile.translate,
      readingLevelTarget: profile.reading_level_target,
      readingLevelCeiling: profile.reading_level_hard_ceiling,
      addresseeMode: profile.addressee_mode,
      community: profile.community,
      messenger: profile.messenger,
      notes: profile.notes ?? null,
      fromMethodVersion: method.manifest.method_version,
    };
    await prisma.targetProfile.upsert({
      where: { key: profile.id },
      create: { key: profile.id, ...data },
      update: data,
    });
  }
  return method.manifest.profiles.length;
}

/**
 * Snapshot the method as it stands right now. Runs point at the snapshot, so
 * editing the rule files afterwards cannot rewrite what a completed adaptation
 * was produced by (DECISIONS.md, D-04).
 */
export async function snapshotMethod(method: LoadedMethod = loadMethod()) {
  const existing = await prisma.methodSnapshot.findUnique({
    where: { methodSha256: method.methodSha256 },
  });
  if (existing) return existing;

  return prisma.methodSnapshot.create({
    data: {
      methodVersion: method.manifest.method_version,
      methodSha256: method.methodSha256,
      filesJson: JSON.stringify(method.files),
      fileCount: Object.keys(method.files).length,
      ruleCount: method.ruleCount,
      ruleStatusCountsJson: JSON.stringify(method.statusCounts),
    },
  });
}

export interface CreateDocumentInput {
  title: string;
  sourceText: string;
  condition: string;
  sourceOrganisation: string;
  intendedAudience: string;
  sourceUrl?: string | null;
  sourceFilename?: string | null;
  notes?: string | null;
}

export async function createSourceDocument(input: CreateDocumentInput) {
  return prisma.sourceDocument.create({
    data: {
      title: input.title,
      sourceText: input.sourceText,
      sourceSha256: sha256(input.sourceText),
      condition: input.condition,
      sourceOrganisation: input.sourceOrganisation,
      intendedAudience: input.intendedAudience,
      sourceUrl: input.sourceUrl ?? null,
      sourceFilename: input.sourceFilename ?? null,
      notes: input.notes ?? null,
    },
  });
}

export async function createRun(args: {
  sourceDocumentId: string;
  profileKey: string;
  parentRunId?: string | null;
}) {
  const method = loadMethod();
  // Fail before creating anything if the profile is not in the method files.
  profileFromManifest(method, args.profileKey);
  await syncProfiles(method);
  const snapshot = await snapshotMethod(method);

  const priorRuns = await prisma.adaptationRun.count({
    where: { sourceDocumentId: args.sourceDocumentId },
  });

  return prisma.adaptationRun.create({
    data: {
      sourceDocumentId: args.sourceDocumentId,
      targetProfileKey: args.profileKey,
      methodSnapshotId: snapshot.id,
      versionNumber: priorRuns + 1,
      parentRunId: args.parentRunId ?? null,
      status: "CREATED",
    },
  });
}

export type Progress = (message: string) => void;

/**
 * Stages 1-3. Stops at plan review by design: the method author inspects and
 * edits the plan before any text is rewritten.
 */
export async function runThroughPlan(runId: string, log: Progress = () => {}) {
  log("Stage 1/6 extract — building the safety contract");
  const extracted = await runExtract(runId);
  log(`  ${extracted.assertions.length} clinical assertions, ${extracted.assertions.filter((a) => a.isProtected).length} protected`);

  log("Stage 2/6 analyse — reading level, risk format, addressee, culture");
  await runAnalyse(runId);

  log("Stage 3/6 plan — which rules fire, and what each will change");
  const plan = await runPlan(runId);
  log(`  ${plan.items.length} planned changes. Stopping for plan review.`);
  return plan;
}

/** Stages 4-6. Requires a plan; the caller is responsible for approving it. */
export async function runAfterPlan(runId: string, log: Progress = () => {}) {
  log("Stage 4/6 rewrite — executing the approved plan");
  const rewritten = await runRewrite(runId);
  log(`  ${rewritten.changes.length} changes recorded`);

  log("Stage 5/6 verify — hunting for clinical drift, without sight of the plan");
  const verdicts = await runVerify(runId);
  const drift = verdicts.checks.filter((c) => c.verdict !== "PRESENT_UNCHANGED");
  log(`  ${verdicts.checks.length} assertions checked, ${drift.length} flagged`);

  log("Stage 6/6 back-translate");
  const back = await runBackTranslate(runId);
  if (back.skipped) log("  skipped: this profile does not translate");

  const run = await prisma.adaptationRun.findUniqueOrThrow({ where: { id: runId } });
  log(run.status === "BLOCKED" ? `BLOCKED — ${run.blockedReason}` : "Ready for review.");
  return run;
}

export async function runAll(runId: string, log: Progress = () => {}) {
  await runThroughPlan(runId, log);
  log("Plan auto-approved (--yes)");
  await prisma.changePlanItem.updateMany({
    where: { runId, status: "PROPOSED" },
    data: { status: "APPROVED" },
  });
  return runAfterPlan(runId, log);
}
