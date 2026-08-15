"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "../src/db";
import { generateGovernanceRecord } from "../src/governance";
import { sha256 } from "../src/llm";
import { createRun, createSourceDocument, runAfterPlan, runThroughPlan } from "../src/pipeline/run";
import { applyBlockingState, runAnalyse, runBackTranslate, runExtract, runPlan, runRewrite, runVerify } from "../src/pipeline/stages";

/**
 * Every mutation the UI can make. They are thin: the rules about what is
 * allowed live in the pipeline and in the method, not in the screens.
 */

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

export async function createDocumentAndRun(form: FormData) {
  const sourceText = str(form, "sourceText");
  if (!sourceText) throw new Error("Paste or upload the source document first.");

  const document = await createSourceDocument({
    title: str(form, "title") || "Untitled document",
    sourceText,
    condition: str(form, "condition"),
    sourceOrganisation: str(form, "sourceOrganisation"),
    intendedAudience: str(form, "intendedAudience"),
    sourceUrl: str(form, "sourceUrl") || null,
    notes: str(form, "notes") || null,
  });

  const run = await createRun({
    sourceDocumentId: document.id,
    profileKey: str(form, "profileKey") || "cald-en-g5",
  });

  redirect(`/runs/${run.id}`);
}

/** Stages 1-3, stopping at plan review. */
export async function startPipeline(form: FormData) {
  const runId = str(form, "runId");
  await runThroughPlan(runId);
  revalidatePath(`/runs/${runId}`);
}

/** Stages 4-6, after the plan has been inspected. */
export async function continuePipeline(form: FormData) {
  const runId = str(form, "runId");
  await prisma.changePlanItem.updateMany({
    where: { runId, status: "PROPOSED" },
    data: { status: "APPROVED" },
  });
  await runAfterPlan(runId);
  revalidatePath(`/runs/${runId}`);
}

export async function rerunStage(form: FormData) {
  const runId = str(form, "runId");
  const stage = str(form, "stage");
  const stages: Record<string, (id: string) => Promise<unknown>> = {
    EXTRACT: runExtract,
    ANALYSE: runAnalyse,
    PLAN: runPlan,
    REWRITE: runRewrite,
    VERIFY: runVerify,
    BACKTRANSLATE: runBackTranslate,
  };
  const fn = stages[stage];
  if (!fn) throw new Error(`Unknown stage ${stage}`);
  await fn(runId);
  revalidatePath(`/runs/${runId}`);
}

export async function updatePlanItem(form: FormData) {
  const id = str(form, "planItemId");
  const item = await prisma.changePlanItem.update({
    where: { id },
    data: {
      intent: str(form, "intent"),
      status: str(form, "status") || "EDITED",
      authorEditNote: str(form, "authorEditNote") || null,
    },
  });
  revalidatePath(`/runs/${item.runId}`);
}

export async function removePlanItem(form: FormData) {
  const id = str(form, "planItemId");
  const item = await prisma.changePlanItem.update({ where: { id }, data: { status: "REMOVED" } });
  revalidatePath(`/runs/${item.runId}`);
}

/**
 * Accept, reject or edit one change. A rejection carries a taxonomy code and
 * free text; codes that imply a method problem become refinement candidates,
 * and CLINICAL_DRIFT additionally re-blocks the document.
 */
export async function decideChange(form: FormData) {
  const changeId = str(form, "changeId");
  const decision = str(form, "decision");
  const reasonCode = str(form, "reasonCode");
  const reasonText = str(form, "reasonText");
  const editedText = str(form, "editedText");
  const reviewerId = str(form, "reviewerId") || null;

  if (decision === "REJECTED" && !reasonCode) {
    throw new Error("A rejection needs a reason code — that is what turns it into a method refinement.");
  }
  if (decision === "EDITED" && !editedText) {
    throw new Error("An edit needs the replacement text.");
  }

  const change = await prisma.change.update({
    where: { id: changeId },
    data: {
      decision,
      decisionReasonCode: decision === "REJECTED" ? reasonCode : null,
      decisionReasonText: reasonText || null,
      editedText: decision === "EDITED" ? editedText : null,
      decidedById: reviewerId,
      decidedAt: new Date(),
    },
  });

  const CREATES_CANDIDATE = [
    "WRONG_RULE_FIRED",
    "RULE_RIGHT_EXECUTION_WRONG",
    "CLINICAL_DRIFT",
    "CULTURAL_MISS",
    "UNNECESSARY_CHANGE",
  ];

  if (decision === "REJECTED" && CREATES_CANDIDATE.includes(reasonCode)) {
    await prisma.methodRefinementCandidate.create({
      data: {
        changeId: change.id,
        ruleId: change.ruleId,
        dimension: change.ruleDimension,
        reasonCode,
        reasonText: reasonText || "(no detail given)",
        status: "NEW",
      },
    });
  }

  if (decision === "REJECTED" && reasonCode === "CLINICAL_DRIFT") {
    // The reviewer found drift the fidelity stage missed. That is a blocking
    // flag like any other, and it re-blocks the document.
    await prisma.assertionCheck.create({
      data: {
        runId: change.runId,
        stage: "REVIEWER",
        verdict: "MEANING_ALTERED",
        blocking: true,
        explanation: `Raised by a reviewer against change ${change.ordinal} (${change.ruleId}): ${reasonText || "clinical drift"}`,
        evidenceQuote: change.afterText,
        ruleIds: JSON.stringify([change.ruleId]),
      },
    });
  }

  if (decision === "REJECTED" && reasonCode === "SOURCE_IS_WRONG") {
    await prisma.sourceIssue.create({
      data: {
        runId: change.runId,
        description: reasonText || "Reviewer reported the source document is clinically wrong.",
        raisedById: reviewerId,
      },
    });
  }

  await applyBlockingState(change.runId);
  revalidatePath(`/runs/${change.runId}/review`);
}

export async function resolveCheck(form: FormData) {
  const checkId = str(form, "checkId");
  const status = str(form, "status");
  const note = str(form, "resolutionNote");
  if (!note) {
    throw new Error("Resolving a fidelity flag requires a written reason. That reason is the record.");
  }
  const check = await prisma.assertionCheck.update({
    where: { id: checkId },
    data: {
      resolutionStatus: status,
      resolutionNote: note,
      resolvedById: str(form, "reviewerId") || null,
      resolvedAt: new Date(),
    },
  });
  await applyBlockingState(check.runId);
  revalidatePath(`/runs/${check.runId}`);
  revalidatePath(`/runs/${check.runId}/review`);
}

/**
 * Compose the final text from the model's adaptation plus the reviewer's
 * decisions: edits replace the model's wording, rejections revert to the
 * source wording. Anything that could not be located is reported rather than
 * silently skipped.
 */
export async function composeFinalText(runId: string): Promise<{ text: string; unapplied: number[] }> {
  const run = await prisma.adaptationRun.findUniqueOrThrow({ where: { id: runId } });
  const changes = await prisma.change.findMany({ where: { runId }, orderBy: { ordinal: "asc" } });

  let text = run.adaptedText ?? "";
  const unapplied: number[] = [];

  for (const change of changes) {
    if (change.decision === "EDITED" && change.editedText) {
      if (text.includes(change.afterText)) text = text.replace(change.afterText, change.editedText);
      else unapplied.push(change.ordinal);
    }
    if (change.decision === "REJECTED") {
      if (change.afterText && text.includes(change.afterText)) {
        text = text.replace(change.afterText, change.beforeText);
      } else {
        unapplied.push(change.ordinal);
      }
    }
  }
  return { text, unapplied };
}

export async function applyDecisions(form: FormData) {
  const runId = str(form, "runId");
  const { text } = await composeFinalText(runId);
  await prisma.adaptationRun.update({
    where: { id: runId },
    data: { finalText: text, finalSha256: sha256(text) },
  });
  revalidatePath(`/runs/${runId}/review`);
}

export async function signOff(form: FormData) {
  const runId = str(form, "runId");

  const openBlocking = await prisma.assertionCheck.count({
    where: { runId, blocking: true, resolutionStatus: "OPEN" },
  });
  if (openBlocking > 0) {
    throw new Error(
      `${openBlocking} fidelity flag(s) are still open. A document cannot be signed off with unresolved flags, and there is no override.`,
    );
  }

  await prisma.signoff.create({
    data: {
      runId,
      reviewerId: str(form, "reviewerId"),
      role: str(form, "role"),
      scope: str(form, "scope"),
      verdict: str(form, "verdict"),
      note: str(form, "note") || null,
    },
  });

  const pending = await prisma.change.count({ where: { runId, decision: "PENDING" } });
  if (pending === 0) {
    await prisma.adaptationRun.update({
      where: { id: runId },
      data: { status: "REVIEW_COMPLETE", completedAt: new Date() },
    });
  }
  revalidatePath(`/runs/${runId}/review`);
  revalidatePath(`/runs/${runId}/governance`);
}

export async function generateRecord(form: FormData) {
  const runId = str(form, "runId");
  await generateGovernanceRecord(runId, str(form, "reviewerId") || null);
  revalidatePath(`/runs/${runId}/governance`);
}

export async function updateRefinement(form: FormData) {
  await prisma.methodRefinementCandidate.update({
    where: { id: str(form, "candidateId") },
    data: {
      status: str(form, "status"),
      proposedRuleChange: str(form, "proposedRuleChange") || null,
      resolvedInMethodVersion: str(form, "resolvedInMethodVersion") || null,
    },
  });
  revalidatePath("/method");
}
