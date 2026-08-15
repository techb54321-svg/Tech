/**
 * Seed the database so the app is demonstrable from first run.
 *
 *   npm run seed
 *
 * Idempotent: it clears the seeded document and its runs, then rebuilds them.
 * Documents you added yourself are left alone.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { prisma } from "../src/db";
import { sha256 } from "../src/llm";
import { loadMethod } from "../src/method/loader";
import { snapshotMethod, syncProfiles } from "../src/pipeline/run";
import {
  ADAPTED_V1,
  ADAPTED_V2,
  CHANGES,
  SEED_MODEL,
  SOURCE_ASSERTIONS,
  type SeedAssertion,
} from "../seed/worked-example";

const SEED_TITLE = "Understanding Your Heart Risk";
const PROFILE_KEY = "cald-en-g5";

const STAGE_NOTES: Record<string, string> = {
  EXTRACT: "Hand-authored seed: the clinical assertions a real extraction stage would produce.",
  ANALYSE: "Hand-authored seed: readability computed in code; the rest written by hand.",
  PLAN: "Hand-authored seed: the change plan behind the changes recorded on this run.",
  REWRITE: "Hand-authored seed: the adapted text and its change list.",
  VERIFY_EXTRACT: "Hand-authored seed: assertions re-extracted from the adapted text.",
  VERIFY_MATCH: "Hand-authored seed: fidelity verdicts.",
  BACKTRANSLATE: "Not run: this profile produces English without translation.",
};

async function stageRow(runId: string, stage: string, input: unknown, output: unknown) {
  const prompt = `[seed] ${STAGE_NOTES[stage] ?? stage}`;
  await prisma.stageRun.create({
    data: {
      runId,
      stage,
      attempt: 1,
      status: "OK",
      promptTemplateId: "hand-authored-seed",
      promptTemplateVersion: "0",
      promptText: prompt,
      promptSha256: sha256(prompt),
      model: SEED_MODEL,
      inputJson: JSON.stringify(input),
      outputJson: JSON.stringify(output),
      finishedAt: new Date(),
    },
  });
}

async function assertionRows(runId: string, origin: string, assertions: SeedAssertion[]) {
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

async function main() {
  const method = loadMethod();
  await syncProfiles(method);
  const snapshot = await snapshotMethod(method);

  // Clear any previous seed, leaving the user's own documents untouched.
  const previous = await prisma.sourceDocument.findMany({ where: { title: SEED_TITLE } });
  for (const doc of previous) {
    await prisma.adaptationRun.deleteMany({ where: { sourceDocumentId: doc.id } });
    await prisma.sourceDocument.delete({ where: { id: doc.id } });
  }

  const author = await prisma.reviewer.upsert({
    where: { id: "seed-author" },
    create: {
      id: "seed-author",
      name: "Method author",
      role: "AUTHOR",
    },
    update: {},
  });
  await prisma.reviewer.upsert({
    where: { id: "seed-community-reviewer" },
    create: {
      id: "seed-community-reviewer",
      name: "Community reviewer (final spot-check)",
      role: "COMMUNITY_REVIEWER",
    },
    update: {},
  });

  const sourceText = readFileSync(join(process.cwd(), "seed/heart-health-brochure.md"), "utf8");
  const document = await prisma.sourceDocument.create({
    data: {
      title: SEED_TITLE,
      sourceText,
      sourceSha256: sha256(sourceText),
      condition: "Cardiovascular disease",
      sourceOrganisation: "Northern Metropolitan Health Service",
      intendedAudience: "Adults at raised cardiovascular risk",
      sourceFilename: "heart-health-brochure.md",
      notes:
        "SYNTHETIC. Written for this repository to look like a real Australian CVD prevention brochure. Not a real document from any health service. See seed/README.md.",
    },
  });

  // -------------------------------------------------------------------------
  // Version 1 — blocked by three fidelity flags
  // -------------------------------------------------------------------------

  const v1 = await prisma.adaptationRun.create({
    data: {
      sourceDocumentId: document.id,
      targetProfileKey: PROFILE_KEY,
      methodSnapshotId: snapshot.id,
      versionNumber: 1,
      status: "BLOCKED",
      adaptedText: ADAPTED_V1,
    },
  });

  await assertionRows(v1.id, "SOURCE", SOURCE_ASSERTIONS);
  await assertionRows(
    v1.id,
    "ADAPTED",
    SOURCE_ASSERTIONS.map((a) => {
      if (a.stableId === "CA-012") {
        return {
          ...a,
          text: "Do not stop taking this medicine without speaking to your doctor.",
          verbatimQuote: "Do not stop taking this medicine. Speak to your doctor first.",
          conditions: [],
        };
      }
      if (a.stableId === "CA-015") {
        return {
          ...a,
          text: "Call an ambulance for chest pain lasting more than 10 minutes, pain spreading to the arm or jaw, trouble breathing, or feeling sick or sweating.",
          verbatimQuote: "Call an ambulance if you have any of these:",
        };
      }
      return a;
    }),
  );

  for (const stage of ["EXTRACT", "ANALYSE", "PLAN", "REWRITE", "VERIFY_EXTRACT", "VERIFY_MATCH"]) {
    await stageRow(v1.id, stage, { seeded: true }, { seeded: true });
  }
  await stageRow(v1.id, "BACKTRANSLATE", { skipped: true }, { skipped: true, reason: STAGE_NOTES.BACKTRANSLATE });

  for (const change of CHANGES) {
    const before = change.ordinal === 18 ? change.beforeText : change.beforeText;
    const after =
      change.ordinal === 18
        ? change.afterText.replace("straight away ", "")
        : change.ordinal === 17
          ? `${change.afterText} Most people take them without any problems.`
          : change.afterText;
    await prisma.change.create({
      data: {
        runId: v1.id,
        ordinal: change.ordinal,
        ruleId: change.ruleId,
        ruleDimension: change.ruleDimension,
        ruleStatus: change.ruleStatus,
        beforeText: before,
        afterText: after,
        rationalePlain: change.rationalePlain,
        flagType: change.flagType ?? null,
        touchesAssertionIds: JSON.stringify(change.touchesAssertionIds ?? []),
      },
    });
  }

  const v1Source = await prisma.clinicalAssertion.findMany({
    where: { runId: v1.id, origin: "SOURCE" },
  });
  const v1Adapted = await prisma.clinicalAssertion.findMany({
    where: { runId: v1.id, origin: "ADAPTED" },
  });
  const findSource = (id: string) => v1Source.find((a) => a.stableId === id)!.id;
  const findAdapted = (id: string) => v1Adapted.find((a) => a.stableId === id)!.id;

  for (const a of SOURCE_ASSERTIONS) {
    if (a.stableId === "CA-012" || a.stableId === "CA-015") continue;
    await prisma.assertionCheck.create({
      data: {
        runId: v1.id,
        stage: "VERIFY",
        sourceAssertionId: findSource(a.stableId),
        matchedAssertionId: findAdapted(a.stableId),
        verdict: "PRESENT_UNCHANGED",
        blocking: false,
        explanation:
          "Present in the adapted text with the same meaning, the same strength, the same numbers and the same conditions.",
        ruleIds: JSON.stringify(a.protectedRuleIds),
      },
    });
  }

  await prisma.assertionCheck.createMany({
    data: [
      {
        runId: v1.id,
        stage: "VERIFY",
        sourceAssertionId: findSource("CA-015"),
        matchedAssertionId: findAdapted("CA-015"),
        verdict: "WEAKENED",
        blocking: true,
        explanation:
          'The source says "Call an ambulance immediately". The adaptation says "Call an ambulance", with no urgency word. Every symptom survived and the 10-minute threshold survived, but the instruction now reads as something to do at the reader\'s convenience. NS-01 does not permit an urgency word to be dropped.',
        evidenceQuote: "Call an ambulance if you have any of these:",
        ruleIds: JSON.stringify(["NS-01"]),
      },
      {
        runId: v1.id,
        stage: "VERIFY",
        sourceAssertionId: findSource("CA-012"),
        matchedAssertionId: findAdapted("CA-012"),
        verdict: "CONDITION_DROPPED",
        blocking: true,
        explanation:
          'The source condition "even if you feel well" is absent from the adaptation. That clause is the entire point of the instruction: it addresses the reader who has stopped feeling unwell and concludes they no longer need the medicine.',
        evidenceQuote: "Do not stop taking this medicine. Speak to your doctor first.",
        ruleIds: JSON.stringify(["NS-04", "NS-08"]),
      },
      {
        runId: v1.id,
        stage: "VERIFY",
        sourceAssertionId: null,
        matchedAssertionId: null,
        verdict: "INVENTED",
        blocking: true,
        explanation:
          '"Most people take them without any problems" is a claim about tolerability that the source document does not make anywhere. It is reassurance the adaptation invented, and a reader would take it as clinical information.',
        evidenceQuote: "Most people take them without any problems.",
        ruleIds: JSON.stringify(["REG-02"]),
      },
    ],
  });

  await prisma.adaptationRun.update({
    where: { id: v1.id },
    data: {
      blockedReason:
        "3 unresolved fidelity flags. The document cannot reach review until every one is resolved.",
    },
  });

  // -------------------------------------------------------------------------
  // Version 2 — the same source, re-run with those three corrected
  // -------------------------------------------------------------------------

  const v2 = await prisma.adaptationRun.create({
    data: {
      sourceDocumentId: document.id,
      targetProfileKey: PROFILE_KEY,
      methodSnapshotId: snapshot.id,
      versionNumber: 2,
      parentRunId: v1.id,
      status: "IN_REVIEW",
      adaptedText: ADAPTED_V2,
    },
  });

  await assertionRows(v2.id, "SOURCE", SOURCE_ASSERTIONS);
  await assertionRows(v2.id, "ADAPTED", SOURCE_ASSERTIONS);

  for (const stage of ["EXTRACT", "ANALYSE", "PLAN", "REWRITE", "VERIFY_EXTRACT", "VERIFY_MATCH"]) {
    await stageRow(v2.id, stage, { seeded: true }, { seeded: true });
  }
  await stageRow(v2.id, "BACKTRANSLATE", { skipped: true }, { skipped: true, reason: STAGE_NOTES.BACKTRANSLATE });

  for (const change of CHANGES) {
    await prisma.changePlanItem.create({
      data: {
        runId: v2.id,
        ordinal: change.ordinal,
        ruleId: change.ruleId,
        ruleDimension: change.ruleDimension,
        ruleStatus: change.ruleStatus,
        targetQuote: change.beforeText,
        intent: change.rationalePlain.split(". ")[0],
        rationale: change.rationalePlain,
        touchesAssertionIds: JSON.stringify(change.touchesAssertionIds ?? []),
        touchesProtected: (change.touchesAssertionIds ?? []).some(
          (id) => SOURCE_ASSERTIONS.find((a) => a.stableId === id)?.isProtected,
        ),
        status: "APPROVED",
      },
    });
  }

  const planItems = await prisma.changePlanItem.findMany({ where: { runId: v2.id } });
  const planByOrdinal = new Map(planItems.map((p) => [p.ordinal, p.id]));

  for (const change of CHANGES) {
    // A few decisions are pre-made so the review screen and the governance
    // record show what a worked-through document looks like. The rest are
    // left pending, which is what the reviewer sees on a fresh run.
    const decided: Record<number, { decision: string; reasonCode?: string; reasonText?: string; editedText?: string }> = {
      5: { decision: "ACCEPTED" },
      14: {
        decision: "EDITED",
        editedText:
          "At festivals and family gatherings there is more food than usual. These are the times it is easiest to eat much more than you planned.",
      },
      9: {
        decision: "REJECTED",
        reasonCode: "RULE_RIGHT_EXECUTION_WRONG",
        reasonText:
          "Family-inclusive framing is right for this profile, but this sentence reads as an instruction to the family rather than to the reader. The rule needs to say that the added sentence must keep the reader as its subject.",
      },
    };
    const decision = decided[change.ordinal];

    await prisma.change.create({
      data: {
        runId: v2.id,
        planItemId: planByOrdinal.get(change.ordinal) ?? null,
        ordinal: change.ordinal,
        ruleId: change.ruleId,
        ruleDimension: change.ruleDimension,
        ruleStatus: change.ruleStatus,
        beforeText: change.beforeText,
        afterText: change.afterText,
        rationalePlain: change.rationalePlain,
        flagType: change.flagType ?? null,
        touchesAssertionIds: JSON.stringify(change.touchesAssertionIds ?? []),
        decision: decision?.decision ?? "PENDING",
        decisionReasonCode: decision?.reasonCode ?? null,
        decisionReasonText: decision?.reasonText ?? null,
        editedText: decision?.editedText ?? null,
        decidedById: decision ? author.id : null,
        decidedAt: decision ? new Date() : null,
      },
    });
  }

  const rejected = await prisma.change.findFirst({ where: { runId: v2.id, decision: "REJECTED" } });
  if (rejected) {
    await prisma.methodRefinementCandidate.create({
      data: {
        changeId: rejected.id,
        ruleId: rejected.ruleId,
        dimension: rejected.ruleDimension,
        reasonCode: rejected.decisionReasonCode!,
        reasonText: rejected.decisionReasonText!,
        proposedRuleChange:
          "ADR-01, FAMILY_INCLUSIVE: add that any sentence naming the family must keep the reader as the subject of the instruction, and give a wrong-example showing the failure.",
        status: "NEW",
      },
    });
  }

  const v2Source = await prisma.clinicalAssertion.findMany({
    where: { runId: v2.id, origin: "SOURCE" },
  });
  const v2Adapted = await prisma.clinicalAssertion.findMany({
    where: { runId: v2.id, origin: "ADAPTED" },
  });

  for (const a of SOURCE_ASSERTIONS) {
    await prisma.assertionCheck.create({
      data: {
        runId: v2.id,
        stage: "VERIFY",
        sourceAssertionId: v2Source.find((r) => r.stableId === a.stableId)!.id,
        matchedAssertionId: v2Adapted.find((r) => r.stableId === a.stableId)!.id,
        verdict: "PRESENT_UNCHANGED",
        blocking: false,
        explanation:
          a.stableId === "CA-015"
            ? 'Every symptom is present, the 10-minute threshold is unchanged, and the urgency word survives as "straight away", which carries the same instruction as "immediately".'
            : a.stableId === "CA-012"
              ? 'Present with its condition intact: "even if you feel well" survives as a separate sentence clause.'
              : "Present in the adapted text with the same meaning, the same strength, the same numbers and the same conditions.",
        ruleIds: JSON.stringify(a.protectedRuleIds),
      },
    });
  }

  console.log("");
  console.log(`Seeded "${SEED_TITLE}" (synthetic source document)`);
  console.log(`  v1 ${v1.id}  BLOCKED — 3 fidelity flags`);
  console.log(`  v2 ${v2.id}  IN_REVIEW — ${CHANGES.length} changes, 3 already decided`);
  console.log("");
  console.log("Start the app with: npm run dev");
  console.log("");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
