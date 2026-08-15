import { prisma } from "../db";
import { adaptationModel, fidelityModel } from "../env";
import { callStage, recordSkippedStage, sha256 } from "../llm";
import { loadMethodFromSnapshot } from "../method/loader";
import type { LoadedMethod } from "../method/types";
import { analyseReadability, splitSections } from "../readability";
import {
  analyseJsonSchema,
  AnalysisOutputSchema,
  type AnalysisOutput,
  type Assertion,
} from "./schemas";
import {
  backTranslationJsonSchema,
  BackTranslationOutputSchema,
  extractJsonSchema,
  ExtractOutputSchema,
  planJsonSchema,
  PlanOutputSchema,
  rewriteJsonSchema,
  RewriteOutputSchema,
  verifyJsonSchema,
  VerifyOutputSchema,
} from "./schemas";
import {
  analysePrompt,
  analyseSystem,
  backTranslatePrompt,
  backTranslateSystem,
  buildAnalysePrompt,
  buildBackTranslatePrompt,
  buildExtractPrompt,
  buildPlanPrompt,
  buildRewritePrompt,
  buildVerifyExtractPrompt,
  buildVerifyMatchPrompt,
  extractPrompt,
  extractSystem,
  planPrompt,
  planSystem,
  rewritePrompt,
  rewriteSystem,
  verifyExtractPrompt,
  verifyMatchPrompt,
  verifyMatchSystem,
} from "./prompts";

/**
 * The six stages. Each one loads what it needs, makes exactly one kind of model
 * call, writes its domain rows, and moves the run's status. None of them calls
 * another: the orchestrator in run.ts decides what happens next, so any stage
 * can be re-run on its own from the UI or the CLI.
 */

export const STAGE_ORDER = [
  "EXTRACT",
  "ANALYSE",
  "PLAN",
  "REWRITE",
  "VERIFY",
  "BACKTRANSLATE",
] as const;
export type Stage = (typeof STAGE_ORDER)[number];

export interface RunContext {
  run: Awaited<ReturnType<typeof loadRun>>["run"];
  method: LoadedMethod;
  profile: {
    key: string;
    label: string;
    language: string;
    translate: boolean;
    readingLevelTarget: string;
    readingLevelCeiling: string;
    addresseeMode: string;
    community: string | null;
    messenger: string | null;
  };
}

export async function loadRun(runId: string) {
  const run = await prisma.adaptationRun.findUniqueOrThrow({
    where: { id: runId },
    include: { sourceDocument: true, targetProfile: true, methodSnapshot: true },
  });
  return { run };
}

export async function loadContext(runId: string): Promise<RunContext> {
  const { run } = await loadRun(runId);
  return {
    run,
    // The snapshot, not the files on disk: a run always executes the method it
    // started with, however long ago that was.
    method: loadMethodFromSnapshot(run.methodSnapshot.filesJson),
    profile: run.targetProfile,
  };
}

/**
 * Discard the domain rows produced by a stage and everything downstream of it,
 * so a re-run cannot leave a half-updated document behind. StageRun history is
 * never deleted — the record of what was run stays complete.
 */
export async function resetFrom(runId: string, stage: Stage): Promise<void> {
  const from = STAGE_ORDER.indexOf(stage);
  const clears = async (s: Stage) => STAGE_ORDER.indexOf(s) >= from;

  if (await clears("VERIFY")) {
    await prisma.assertionCheck.deleteMany({ where: { runId, stage: { in: ["VERIFY", "BACKTRANSLATE"] } } });
    await prisma.clinicalAssertion.deleteMany({
      where: { runId, origin: { in: ["ADAPTED", "BACKTRANSLATION"] } },
    });
  }
  if (await clears("REWRITE")) {
    await prisma.change.deleteMany({ where: { runId } });
    await prisma.adaptationRun.update({
      where: { id: runId },
      data: { adaptedText: null, finalText: null, finalSha256: null },
    });
  }
  if (await clears("PLAN")) {
    await prisma.changePlanItem.deleteMany({ where: { runId } });
  }
  if (await clears("EXTRACT")) {
    await prisma.clinicalAssertion.deleteMany({ where: { runId, origin: "SOURCE" } });
  }
}

async function setStatus(runId: string, status: string, blockedReason?: string | null) {
  await prisma.adaptationRun.update({
    where: { id: runId },
    data: { status, ...(blockedReason !== undefined ? { blockedReason } : {}) },
  });
}

async function latestStageOutput<T>(runId: string, stage: string, parse: (raw: unknown) => T): Promise<T> {
  const row = await prisma.stageRun.findFirst({
    where: { runId, stage, status: "OK" },
    orderBy: { attempt: "desc" },
  });
  if (!row?.outputJson) {
    throw new Error(`Stage ${stage} has not produced output for this run yet.`);
  }
  return parse(JSON.parse(row.outputJson));
}

async function assertionsFor(runId: string, origin: string): Promise<Assertion[]> {
  const rows = await prisma.clinicalAssertion.findMany({
    where: { runId, origin },
    orderBy: { stableId: "asc" },
  });
  return rows.map((r) => ({
    stableId: r.stableId,
    category: r.category as Assertion["category"],
    text: r.text,
    verbatimQuote: r.verbatimQuote,
    strength: r.strength as Assertion["strength"],
    numbers: JSON.parse(r.numbersJson),
    conditions: JSON.parse(r.conditionsJson),
    isProtected: r.isProtected,
    protectedRuleIds: JSON.parse(r.protectedRuleIds),
  }));
}

async function persistAssertions(runId: string, origin: string, assertions: Assertion[]) {
  await prisma.clinicalAssertion.deleteMany({ where: { runId, origin } });
  for (const a of assertions) {
    await prisma.clinicalAssertion.create({
      data: {
        runId,
        origin,
        stableId: a.stableId,
        category: a.category,
        text: a.text,
        verbatimQuote: a.verbatimQuote,
        strength: a.strength,
        numbersJson: JSON.stringify(a.numbers),
        conditionsJson: JSON.stringify(a.conditions),
        isProtected: a.isProtected,
        protectedRuleIds: JSON.stringify(a.protectedRuleIds),
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Stage 1 — extract the safety contract
// ---------------------------------------------------------------------------

export async function runExtract(runId: string) {
  const ctx = await loadContext(runId);
  await resetFrom(runId, "EXTRACT");
  await setStatus(runId, "EXTRACTING");

  const prompt = buildExtractPrompt({
    method: ctx.method,
    sourceText: ctx.run.sourceDocument.sourceText,
    label: ctx.run.sourceDocument.title,
  });

  const { result } = await callStage({
    runId,
    stage: "EXTRACT",
    promptTemplateId: extractPrompt.id,
    promptTemplateVersion: extractPrompt.version,
    system: extractSystem,
    prompt,
    model: adaptationModel(),
    maxTokens: 12000,
    toolName: "record_assertions",
    toolDescription: "Record every atomic clinical claim found in the document.",
    inputSchema: extractJsonSchema as unknown as Record<string, unknown>,
    parse: (raw) => ExtractOutputSchema.parse(raw),
    input: { sourceSha256: ctx.run.sourceDocument.sourceSha256 },
  });

  await persistAssertions(runId, "SOURCE", result.assertions);
  await setStatus(runId, "EXTRACTING");
  return result;
}

// ---------------------------------------------------------------------------
// Stage 2 — analyse the source
// ---------------------------------------------------------------------------

export async function runAnalyse(runId: string) {
  const ctx = await loadContext(runId);
  await setStatus(runId, "ANALYSING");

  const text = ctx.run.sourceDocument.sourceText;
  const readability = analyseReadability(text);
  const sectionReadability = splitSections(text).map((s) => {
    const r = analyseReadability(s.body);
    return { heading: s.heading, gradeLevel: r.gradeLevel, maxWordsPerSentence: r.maxWordsPerSentence };
  });

  const { result } = await callStage({
    runId,
    stage: "ANALYSE",
    promptTemplateId: analysePrompt.id,
    promptTemplateVersion: analysePrompt.version,
    system: analyseSystem,
    prompt: buildAnalysePrompt({
      sourceText: text,
      readability,
      sectionReadability,
      label: ctx.run.sourceDocument.title,
    }),
    model: adaptationModel(),
    maxTokens: 12000,
    toolName: "record_analysis",
    toolDescription: "Record the communication properties of the source document.",
    inputSchema: analyseJsonSchema as unknown as Record<string, unknown>,
    parse: (raw) => AnalysisOutputSchema.parse(raw),
    input: { readability, sectionReadability },
  });

  return { analysis: result, readability, sectionReadability };
}

// ---------------------------------------------------------------------------
// Stage 3 — plan the adaptation
// ---------------------------------------------------------------------------

export async function runPlan(runId: string) {
  const ctx = await loadContext(runId);
  await resetFrom(runId, "PLAN");
  await setStatus(runId, "PLANNING");

  const analysis = await latestStageOutput<AnalysisOutput>(runId, "ANALYSE", (raw) =>
    AnalysisOutputSchema.parse(raw),
  );
  const assertions = await assertionsFor(runId, "SOURCE");
  if (assertions.length === 0) {
    throw new Error("Cannot plan before stage 1 has extracted the clinical assertions.");
  }

  const { result } = await callStage({
    runId,
    stage: "PLAN",
    promptTemplateId: planPrompt.id,
    promptTemplateVersion: planPrompt.version,
    system: planSystem,
    prompt: buildPlanPrompt({
      method: ctx.method,
      profile: ctx.profile,
      sourceText: ctx.run.sourceDocument.sourceText,
      analysis,
      assertions,
    }),
    model: adaptationModel(),
    maxTokens: 16000,
    toolName: "record_plan",
    toolDescription: "Record the change plan, one item per discrete change.",
    inputSchema: planJsonSchema as unknown as Record<string, unknown>,
    parse: (raw) => PlanOutputSchema.parse(raw),
    input: { methodSha256: ctx.method.methodSha256, assertionCount: assertions.length },
  });

  const protectedIds = new Set(assertions.filter((a) => a.isProtected).map((a) => a.stableId));

  for (const item of result.items) {
    const rule = ctx.method.rules.find((r) => r.id === item.ruleId);
    await prisma.changePlanItem.create({
      data: {
        runId,
        ordinal: item.ordinal,
        ruleId: item.ruleId,
        ruleDimension: rule?.dimension ?? "unknown",
        ruleStatus: rule?.status ?? "unknown",
        targetQuote: item.targetQuote,
        intent: item.intent,
        rationale: item.rationale,
        touchesAssertionIds: JSON.stringify(item.touchesAssertionIds),
        touchesProtected: item.touchesAssertionIds.some((id) => protectedIds.has(id)),
      },
    });
  }

  await setStatus(runId, "PLAN_REVIEW");
  return result;
}

// ---------------------------------------------------------------------------
// Stage 4 — rewrite
// ---------------------------------------------------------------------------

export async function runRewrite(runId: string) {
  const ctx = await loadContext(runId);
  await resetFrom(runId, "REWRITE");
  await setStatus(runId, "REWRITING");

  const planItems = await prisma.changePlanItem.findMany({
    where: { runId, status: { not: "REMOVED" } },
    orderBy: { ordinal: "asc" },
  });
  if (planItems.length === 0) {
    throw new Error("Cannot rewrite before stage 3 has produced a change plan.");
  }
  const assertions = await assertionsFor(runId, "SOURCE");

  const { result } = await callStage({
    runId,
    stage: "REWRITE",
    promptTemplateId: rewritePrompt.id,
    promptTemplateVersion: rewritePrompt.version,
    system: rewriteSystem,
    prompt: buildRewritePrompt({
      method: ctx.method,
      profile: ctx.profile,
      sourceText: ctx.run.sourceDocument.sourceText,
      planItems,
      assertions,
    }),
    model: adaptationModel(),
    maxTokens: 20000,
    toolName: "record_rewrite",
    toolDescription: "Record the adapted document and every change made to produce it.",
    inputSchema: rewriteJsonSchema as unknown as Record<string, unknown>,
    parse: (raw) => RewriteOutputSchema.parse(raw),
    input: { planItemCount: planItems.length },
  });

  const byOrdinal = new Map(planItems.map((p) => [p.ordinal, p]));

  for (const change of result.changes) {
    const rule = ctx.method.rules.find((r) => r.id === change.ruleId);
    const planItem = change.planItemOrdinal > 0 ? byOrdinal.get(change.planItemOrdinal) : undefined;
    await prisma.change.create({
      data: {
        runId,
        planItemId: planItem?.id ?? null,
        ordinal: change.ordinal,
        ruleId: change.ruleId,
        ruleDimension: rule?.dimension ?? "unknown",
        ruleStatus: rule?.status ?? "unknown",
        beforeText: change.beforeText,
        afterText: change.afterText,
        rationalePlain: change.rationalePlain,
        flagType: change.flagType === "NONE" ? null : change.flagType,
        citesDataEntryId: change.citesDataEntryId || null,
        touchesAssertionIds: JSON.stringify(change.touchesAssertionIds),
      },
    });
  }

  await prisma.adaptationRun.update({
    where: { id: runId },
    data: { adaptedText: result.adaptedText },
  });

  return result;
}

// ---------------------------------------------------------------------------
// Stage 5 — verify fidelity, adversarially and without sight of the plan
// ---------------------------------------------------------------------------

export async function runVerify(runId: string) {
  const ctx = await loadContext(runId);
  const adaptedText = ctx.run.adaptedText;
  if (!adaptedText) throw new Error("Cannot verify before stage 4 has produced an adaptation.");

  await resetFrom(runId, "VERIFY");
  await setStatus(runId, "VERIFYING");

  // 5a. Independent re-extraction. This call is given the adapted text and the
  // never-soften rules, and nothing else — not the plan, not the analysis, not
  // the changes. See DECISIONS.md, D-09.
  const { result: reExtracted } = await callStage({
    runId,
    stage: "VERIFY_EXTRACT",
    promptTemplateId: verifyExtractPrompt.id,
    promptTemplateVersion: verifyExtractPrompt.version,
    system: extractSystem,
    prompt: buildVerifyExtractPrompt({ method: ctx.method, adaptedText }),
    model: fidelityModel(),
    maxTokens: 12000,
    toolName: "record_assertions",
    toolDescription: "Record every atomic clinical claim found in the adapted text.",
    inputSchema: extractJsonSchema as unknown as Record<string, unknown>,
    parse: (raw) => ExtractOutputSchema.parse(raw),
    input: { adaptedSha256: sha256(adaptedText) },
  });

  await persistAssertions(runId, "ADAPTED", reExtracted.assertions);

  const sourceAssertions = await assertionsFor(runId, "SOURCE");

  // 5b. Adversarial match.
  const { result: verdicts } = await callStage({
    runId,
    stage: "VERIFY_MATCH",
    promptTemplateId: verifyMatchPrompt.id,
    promptTemplateVersion: verifyMatchPrompt.version,
    system: verifyMatchSystem,
    prompt: buildVerifyMatchPrompt({
      sourceAssertions,
      adaptedAssertions: reExtracted.assertions,
      adaptedText,
    }),
    model: fidelityModel(),
    maxTokens: 16000,
    toolName: "record_fidelity_checks",
    toolDescription: "Record one fidelity verdict per source assertion, plus any invented claims.",
    inputSchema: verifyJsonSchema as unknown as Record<string, unknown>,
    parse: (raw) => VerifyOutputSchema.parse(raw),
    input: { sourceAssertionCount: sourceAssertions.length },
  });

  await persistChecks(runId, "VERIFY", verdicts.checks);
  await applyBlockingState(runId);
  return verdicts;
}

// ---------------------------------------------------------------------------
// Stage 6 — back-translation check
// ---------------------------------------------------------------------------

export async function runBackTranslate(runId: string) {
  const ctx = await loadContext(runId);

  if (!ctx.profile.translate) {
    await recordSkippedStage(
      runId,
      "BACKTRANSLATE",
      `Profile ${ctx.profile.key} produces ${ctx.profile.language} without translation, so there is nothing to translate back.`,
    );
    return { skipped: true as const };
  }

  const adaptedText = ctx.run.adaptedText;
  if (!adaptedText) throw new Error("Cannot back-translate before stage 4 has produced an adaptation.");

  await setStatus(runId, "BACKTRANSLATING");

  const { result: translated } = await callStage({
    runId,
    stage: "BACKTRANSLATE",
    promptTemplateId: backTranslatePrompt.id,
    promptTemplateVersion: backTranslatePrompt.version,
    system: backTranslateSystem,
    prompt: buildBackTranslatePrompt({ adaptedText, language: ctx.profile.language }),
    model: fidelityModel(),
    maxTokens: 20000,
    toolName: "record_back_translation",
    toolDescription: "Record a literal English back-translation.",
    inputSchema: backTranslationJsonSchema as unknown as Record<string, unknown>,
    parse: (raw) => BackTranslationOutputSchema.parse(raw),
    input: { language: ctx.profile.language },
  });

  const { result: reExtracted } = await callStage({
    runId,
    stage: "BACKTRANSLATE_EXTRACT",
    promptTemplateId: verifyExtractPrompt.id,
    promptTemplateVersion: verifyExtractPrompt.version,
    system: extractSystem,
    prompt: buildVerifyExtractPrompt({
      method: ctx.method,
      adaptedText: translated.backTranslatedText,
    }),
    model: fidelityModel(),
    maxTokens: 12000,
    toolName: "record_assertions",
    toolDescription: "Record every atomic clinical claim found in the back-translated text.",
    inputSchema: extractJsonSchema as unknown as Record<string, unknown>,
    parse: (raw) => ExtractOutputSchema.parse(raw),
    input: { backTranslationSha256: sha256(translated.backTranslatedText) },
  });

  await persistAssertions(runId, "BACKTRANSLATION", reExtracted.assertions);

  const sourceAssertions = await assertionsFor(runId, "SOURCE");
  const { result: verdicts } = await callStage({
    runId,
    stage: "BACKTRANSLATE_MATCH",
    promptTemplateId: verifyMatchPrompt.id,
    promptTemplateVersion: verifyMatchPrompt.version,
    system: verifyMatchSystem,
    prompt: buildVerifyMatchPrompt({
      sourceAssertions,
      adaptedAssertions: reExtracted.assertions,
      adaptedText: translated.backTranslatedText,
    }),
    model: fidelityModel(),
    maxTokens: 16000,
    toolName: "record_fidelity_checks",
    toolDescription: "Record fidelity verdicts against the back-translation.",
    inputSchema: verifyJsonSchema as unknown as Record<string, unknown>,
    parse: (raw) => VerifyOutputSchema.parse(raw),
    input: { sourceAssertionCount: sourceAssertions.length },
  });

  await persistChecks(runId, "BACKTRANSLATE", verdicts.checks);
  await applyBlockingState(runId);
  return { skipped: false as const, verdicts };
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

async function persistChecks(
  runId: string,
  stage: string,
  checks: {
    sourceStableId: string;
    adaptedStableId: string;
    verdict: string;
    explanation: string;
    evidenceQuote: string;
    ruleIds: string[];
  }[],
) {
  const origin = stage === "BACKTRANSLATE" ? "BACKTRANSLATION" : "ADAPTED";
  const sourceRows = await prisma.clinicalAssertion.findMany({ where: { runId, origin: "SOURCE" } });
  const adaptedRows = await prisma.clinicalAssertion.findMany({ where: { runId, origin } });
  const sourceByStableId = new Map(sourceRows.map((r) => [r.stableId, r.id]));
  const adaptedByStableId = new Map(adaptedRows.map((r) => [r.stableId, r.id]));

  for (const check of checks) {
    await prisma.assertionCheck.create({
      data: {
        runId,
        stage,
        sourceAssertionId: sourceByStableId.get(check.sourceStableId) ?? null,
        matchedAssertionId: adaptedByStableId.get(check.adaptedStableId) ?? null,
        verdict: check.verdict,
        // Every verdict other than "unchanged" is a fidelity flag, and every
        // fidelity flag blocks. There is no severity dial: see DECISIONS.md D-08.
        blocking: check.verdict !== "PRESENT_UNCHANGED",
        explanation: check.explanation,
        evidenceQuote: check.evidenceQuote || null,
        ruleIds: JSON.stringify(check.ruleIds),
      },
    });
  }
}

/** A run with any open blocking check is BLOCKED. Nothing else can set it. */
export async function applyBlockingState(runId: string): Promise<{ blocked: boolean; open: number }> {
  const open = await prisma.assertionCheck.count({
    where: { runId, blocking: true, resolutionStatus: "OPEN" },
  });

  if (open > 0) {
    await setStatus(
      runId,
      "BLOCKED",
      `${open} unresolved fidelity flag${open === 1 ? "" : "s"}. The document cannot reach review until every one is resolved.`,
    );
    return { blocked: true, open };
  }

  const run = await prisma.adaptationRun.findUniqueOrThrow({ where: { id: runId } });
  if (run.status !== "REVIEW_COMPLETE") {
    await setStatus(runId, "IN_REVIEW", null);
  }
  return { blocked: false, open: 0 };
}
