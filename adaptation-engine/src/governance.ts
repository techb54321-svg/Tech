import { prisma } from "./db";
import { sha256 } from "./llm";
import { analyseReadability } from "./readability";

/**
 * The governance record.
 *
 * This is the artifact a clinical safety committee reads, so it answers their
 * questions in their order: what was the source, what method was applied, what
 * did the model do, did any clinical meaning move, who checked it, and can this
 * be reproduced. It is built once and stored whole (DECISIONS.md, D-13).
 */

export async function buildGovernancePayload(runId: string) {
  const run = await prisma.adaptationRun.findUniqueOrThrow({
    where: { id: runId },
    include: {
      sourceDocument: true,
      targetProfile: true,
      methodSnapshot: true,
      stages: { orderBy: [{ startedAt: "asc" }] },
      assertions: { orderBy: { stableId: "asc" } },
      checks: { include: { sourceAssertion: true, resolvedBy: true } },
      changes: { include: { decidedBy: true }, orderBy: { ordinal: "asc" } },
      planItems: { orderBy: { ordinal: "asc" } },
      signoffs: { include: { reviewer: true } },
      sourceIssues: { include: { raisedBy: true } },
    },
  });

  const finalText = run.finalText ?? run.adaptedText ?? "";
  const sourceReadability = analyseReadability(run.sourceDocument.sourceText);
  const adaptedReadability = finalText ? analyseReadability(finalText) : null;

  const sourceAssertions = run.assertions.filter((a) => a.origin === "SOURCE");

  const checksByAssertion = new Map<string, typeof run.checks>();
  for (const check of run.checks) {
    const key = check.sourceAssertionId ?? "__invented__";
    const list = checksByAssertion.get(key) ?? [];
    list.push(check);
    checksByAssertion.set(key, list);
  }

  const ruleUsage = new Map<string, { ruleId: string; ruleStatus: string; dimension: string; changes: number }>();
  for (const change of run.changes) {
    const entry = ruleUsage.get(change.ruleId) ?? {
      ruleId: change.ruleId,
      ruleStatus: change.ruleStatus,
      dimension: change.ruleDimension,
      changes: 0,
    };
    entry.changes += 1;
    ruleUsage.set(change.ruleId, entry);
  }

  const flagCounts = run.changes.reduce<Record<string, number>>((acc, c) => {
    if (c.flagType) acc[c.flagType] = (acc[c.flagType] ?? 0) + 1;
    return acc;
  }, {});

  const openBlocking = run.checks.filter((c) => c.blocking && c.resolutionStatus === "OPEN");

  return {
    generatedFor: "clinical governance review",
    status: run.status,
    blocked: openBlocking.length > 0,
    blockedReason: run.blockedReason,

    document: {
      title: run.sourceDocument.title,
      sourceOrganisation: run.sourceDocument.sourceOrganisation,
      condition: run.sourceDocument.condition,
      intendedAudience: run.sourceDocument.intendedAudience,
      sourceUrl: run.sourceDocument.sourceUrl,
      sourceSha256: run.sourceDocument.sourceSha256,
      ingestedAt: run.sourceDocument.ingestedAt.toISOString(),
      notes: run.sourceDocument.notes,
    },

    adaptation: {
      runId: run.id,
      versionNumber: run.versionNumber,
      parentRunId: run.parentRunId,
      createdAt: run.createdAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
      adaptedSha256: finalText ? sha256(finalText) : null,
      reviewerEditsApplied: Boolean(run.finalText && run.finalText !== run.adaptedText),
    },

    targetProfile: {
      key: run.targetProfile.key,
      label: run.targetProfile.label,
      language: run.targetProfile.language,
      translated: run.targetProfile.translate,
      readingLevelTarget: run.targetProfile.readingLevelTarget,
      readingLevelCeiling: run.targetProfile.readingLevelCeiling,
      addresseeMode: run.targetProfile.addresseeMode,
      community: run.targetProfile.community,
      messenger: run.targetProfile.messenger,
    },

    method: {
      version: run.methodSnapshot.methodVersion,
      sha256: run.methodSnapshot.methodSha256,
      capturedAt: run.methodSnapshot.capturedAt.toISOString(),
      ruleCount: run.methodSnapshot.ruleCount,
      ruleStatusCounts: JSON.parse(run.methodSnapshot.ruleStatusCountsJson),
      rulesApplied: [...ruleUsage.values()].sort((a, b) => a.ruleId.localeCompare(b.ruleId)),
      // Stated plainly: how much of this document rests on rules the method
      // author has not confirmed.
      changesFromUnconfirmedRules: run.changes.filter((c) => c.ruleStatus !== "confirmed").length,
    },

    models: run.stages.map((s) => ({
      stage: s.stage,
      attempt: s.attempt,
      status: s.status,
      model: s.model,
      temperature: s.temperature,
      promptTemplate: `${s.promptTemplateId}@${s.promptTemplateVersion}`,
      promptSha256: s.promptSha256,
      inputTokens: s.inputTokens,
      outputTokens: s.outputTokens,
      startedAt: s.startedAt.toISOString(),
      finishedAt: s.finishedAt?.toISOString() ?? null,
      error: s.errorText,
    })),

    readability: {
      source: {
        fleschKincaidGrade: sourceReadability.fleschKincaidGrade,
        smog: sourceReadability.smog,
        gradeLevel: sourceReadability.gradeLevel,
        meanWordsPerSentence: sourceReadability.meanWordsPerSentence,
        maxWordsPerSentence: sourceReadability.maxWordsPerSentence,
        words: sourceReadability.words,
      },
      adapted: adaptedReadability
        ? {
            fleschKincaidGrade: adaptedReadability.fleschKincaidGrade,
            smog: adaptedReadability.smog,
            gradeLevel: adaptedReadability.gradeLevel,
            meanWordsPerSentence: adaptedReadability.meanWordsPerSentence,
            maxWordsPerSentence: adaptedReadability.maxWordsPerSentence,
            words: adaptedReadability.words,
          }
        : null,
      target: run.targetProfile.readingLevelTarget,
      ceiling: run.targetProfile.readingLevelCeiling,
      method: "Flesch-Kincaid grade level and SMOG, computed deterministically in code, not estimated by a model.",
    },

    fidelity: {
      assertionsInSource: sourceAssertions.length,
      protectedAssertions: sourceAssertions.filter((a) => a.isProtected).length,
      checksRun: run.checks.length,
      unchanged: run.checks.filter((c) => c.verdict === "PRESENT_UNCHANGED").length,
      flagged: run.checks.filter((c) => c.verdict !== "PRESENT_UNCHANGED").length,
      openBlocking: openBlocking.length,
      assertions: sourceAssertions.map((a) => ({
        id: a.stableId,
        category: a.category,
        strength: a.strength,
        protected: a.isProtected,
        protectedBy: JSON.parse(a.protectedRuleIds),
        claim: a.text,
        sourceQuote: a.verbatimQuote,
        verdicts: (checksByAssertion.get(a.id) ?? []).map((c) => ({
          stage: c.stage,
          verdict: c.verdict,
          blocking: c.blocking,
          explanation: c.explanation,
          evidence: c.evidenceQuote,
          rules: JSON.parse(c.ruleIds),
          resolution: c.resolutionStatus,
          resolutionNote: c.resolutionNote,
          resolvedBy: c.resolvedBy?.name ?? null,
          resolvedAt: c.resolvedAt?.toISOString() ?? null,
        })),
      })),
      invented: (checksByAssertion.get("__invented__") ?? []).map((c) => ({
        stage: c.stage,
        verdict: c.verdict,
        explanation: c.explanation,
        evidence: c.evidenceQuote,
        resolution: c.resolutionStatus,
        resolutionNote: c.resolutionNote,
      })),
    },

    changes: run.changes.map((c) => ({
      ordinal: c.ordinal,
      rule: c.ruleId,
      ruleStatus: c.ruleStatus,
      dimension: c.ruleDimension,
      flagType: c.flagType,
      citesDataEntry: c.citesDataEntryId,
      before: c.beforeText,
      after: c.decision === "EDITED" && c.editedText ? c.editedText : c.afterText,
      modelProposed: c.afterText,
      rationale: c.rationalePlain,
      decision: c.decision,
      reasonCode: c.decisionReasonCode,
      reasonText: c.decisionReasonText,
      decidedBy: c.decidedBy?.name ?? null,
      decidedAt: c.decidedAt?.toISOString() ?? null,
      touchesAssertions: JSON.parse(c.touchesAssertionIds),
    })),

    changeSummary: {
      total: run.changes.length,
      accepted: run.changes.filter((c) => c.decision === "ACCEPTED").length,
      edited: run.changes.filter((c) => c.decision === "EDITED").length,
      rejected: run.changes.filter((c) => c.decision === "REJECTED").length,
      pending: run.changes.filter((c) => c.decision === "PENDING").length,
      flags: flagCounts,
    },

    signoffs: run.signoffs.map((s) => ({
      reviewer: s.reviewer.name,
      role: s.role,
      scope: s.scope,
      verdict: s.verdict,
      note: s.note,
      signedAt: s.signedAt.toISOString(),
    })),

    sourceIssues: run.sourceIssues.map((i) => ({
      description: i.description,
      raisedBy: i.raisedBy?.name ?? null,
      status: i.status,
      createdAt: i.createdAt.toISOString(),
    })),

    sourceText: run.sourceDocument.sourceText,
    adaptedText: finalText,
  };
}

export type GovernancePayload = Awaited<ReturnType<typeof buildGovernancePayload>>;

/** Render and store an immutable copy. Returns the stored row. */
export async function generateGovernanceRecord(runId: string, generatedById?: string | null) {
  const payload = await buildGovernancePayload(runId);
  const payloadJson = JSON.stringify(payload, null, 2);

  return prisma.governanceRecord.create({
    data: {
      runId,
      methodVersion: payload.method.version,
      methodSha256: payload.method.sha256,
      sourceSha256: payload.document.sourceSha256,
      adaptedSha256: payload.adaptation.adaptedSha256 ?? "",
      modelsJson: JSON.stringify(payload.models),
      payloadJson,
      payloadSha256: sha256(payloadJson),
      generatedById: generatedById ?? null,
    },
  });
}
