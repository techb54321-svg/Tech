import type { LoadedMethod } from "../method/types";
import { renderFoodSubstitutions, renderMethod, renderNeverSoften, renderProfile } from "../method/render";
import type { Readability } from "../readability";
import type { AnalysisOutput, Assertion } from "./schemas";

/**
 * Every prompt in the system, with an ID and a version. Bump the version when
 * you change a template's meaning: StageRun records the template ID and version
 * alongside the fully rendered text, so "which prompt produced this?" stays
 * answerable after the template moves on.
 *
 * Rule text is never written here. It is interpolated from method/ at run time,
 * so the files stay the single source of truth (DECISIONS.md, D-01).
 */

export interface PromptTemplate {
  id: string;
  version: string;
}

const RULE_STATUS_NOTE = `
Each rule carries a status. "confirmed" means the method author stated it.
"assumed" means it was proposed to them and not objected to. "strawman" means
the engine author wrote it and the method author has not confirmed it. Apply
all three equally — the status is recorded for the reviewer, not a licence to
skip a rule.`.trim();

// ---------------------------------------------------------------------------
// Stage 1 — extract
// ---------------------------------------------------------------------------

export const extractPrompt: PromptTemplate = { id: "extract", version: "1.0.0" };

export const extractSystem = `
You are a clinical safety analyst. You are building the safety contract for a
patient-material rewrite: an enumerated list of every clinical claim the source
document makes, against which the rewrite will later be checked.

Be exhaustive and be literal. A claim you omit is a claim nobody will check.
Never merge two claims into one. Never generalise. Never repair a claim that
seems incomplete — record what the document says, not what it should say.
`.trim();

export function buildExtractPrompt(args: {
  method: LoadedMethod;
  sourceText: string;
  label: string;
}): string {
  return `
Extract every atomic clinical claim from the document below.

An atomic claim is one statement that could be true or false on its own:
a dose, a threshold, a warning sign, an action instruction, a contraindication,
a timeframe, a risk statement, an eligibility condition.

For each claim:
- Give it a stable ID: CA-001, CA-002, ... in document order.
- Restate it atomically in "text", carrying every condition that governs it.
- Copy the exact source span into "verbatimQuote", character for character.
- Record its strength: MUST, SHOULD, MAY, or STATEMENT. Read the modal verb of
  the source, not the seriousness of the topic.
- Record every number with its unit and its direction word ("under", "at least",
  "within"). The direction word carries as much meaning as the number.
- List each governing condition separately. An unconditional claim has none.
- Mark isProtected true where any never-soften rule below applies, and list
  those rule IDs.

Do not extract: headings, general encouragement, descriptions of the document
itself, or contact details that carry no clinical instruction.

## Never-soften rules (for deciding isProtected)

${renderNeverSoften(args.method)}

## Document: ${args.label}

<document>
${args.sourceText}
</document>
`.trim();
}

// ---------------------------------------------------------------------------
// Stage 2 — analyse
// ---------------------------------------------------------------------------

export const analysePrompt: PromptTemplate = { id: "analyse", version: "1.0.0" };

export const analyseSystem = `
You are a health-literacy and cross-cultural communication analyst. You are
describing a source document's communication properties before it is adapted.

Describe what is there. Do not propose fixes, and do not rewrite anything: a
later stage plans the changes, and it must not inherit your suggestions as
though they were findings.
`.trim();

export function buildAnalysePrompt(args: {
  sourceText: string;
  readability: Readability;
  sectionReadability: { heading: string; gradeLevel: number; maxWordsPerSentence: number }[];
  label: string;
}): string {
  return `
Analyse the communication properties of the document below.

Readability has already been computed deterministically and is given to you.
Do not estimate it again; use it as context for the judgements you are making.

## Computed readability (do not re-estimate)

Whole document: Flesch-Kincaid grade ${args.readability.fleschKincaidGrade}, SMOG ${args.readability.smog}.
Sentences: ${args.readability.sentences}, mean ${args.readability.meanWordsPerSentence} words,
longest ${args.readability.maxWordsPerSentence} words, ${args.readability.sentencesOver20} over 20 words.

By section:
${args.sectionReadability.map((s) => `- ${s.heading}: grade ${s.gradeLevel}, longest sentence ${s.maxWordsPerSentence} words`).join("\n")}

## What to report

- addressee: who the document speaks to, with the evidence that shows it.
- riskStatements: every statement of risk, its format, whether it names a
  comparison group and a timeframe, and — for relative risks — whether the
  absolute numbers needed to convert it appear anywhere in this document.
- culturalAssumptions: assumptions about food, household, calendar, religion,
  work, transport, or who makes decisions.
- idioms: expressions whose literal reading differs from their intended one.
  Give the literal reading explicitly.
- jargon: clinical terms, whether the source defines them, and whether the
  reader will meet the term elsewhere in the health system (KEEP_AND_DEFINE)
  or never needs it again (REPLACE).
- mealtimeAssumptions: assumptions about meal structure and timing.
- framingProblems: fatalism, blame, over-promised control, unspecified
  exhortation.
- attributions: claims attributed to a body, naming it; and claims attributed
  vaguely, with namedSource empty.

Quote exactly. Every finding must carry the span it came from.

## Document: ${args.label}

<document>
${args.sourceText}
</document>
`.trim();
}

// ---------------------------------------------------------------------------
// Stage 3 — plan
// ---------------------------------------------------------------------------

export const planPrompt: PromptTemplate = { id: "plan", version: "1.0.0" };

export const planSystem = `
You are applying an explicit, versioned adaptation method to a source document.

You are planning, not writing. Produce the list of changes that the method
requires, before any rewriting happens, so that a human can inspect and correct
the plan first.

Every planned change must cite the one rule that requires it. If you cannot name
a rule, the change is not part of the method and must not be planned.
`.trim();

export function buildPlanPrompt(args: {
  method: LoadedMethod;
  profile: Parameters<typeof renderProfile>[0];
  sourceText: string;
  analysis: AnalysisOutput;
  assertions: Assertion[];
}): string {
  return `
Plan the adaptation of the document below.

${RULE_STATUS_NOTE}

Rules of planning:
- One plan item per discrete change. Do not bundle.
- Every item cites exactly one ruleId. That rule must require the change.
- targetQuote is the exact source span the change acts on.
- intent says concretely what will change. "Improve clarity" is not an intent;
  "replace 15% with a room of 100 people, naming the comparison group and the
  10-year period" is.
- List every clinical assertion ID the change touches. Where an assertion is
  protected, the plan item must say how the protected content survives.
- Where a rule requires a flag instead of a change (no signed-off food
  substitution, fasting guidance, a missing denominator, an instruction whose
  reason the source never gives), plan the flag as an item and say so in the
  intent. Do not plan to invent the missing content.
- Never plan a change that adds a clinical claim the source does not make.

## Target profile

${renderProfile(args.profile)}

## Permitted food substitutions

${renderFoodSubstitutions(args.method, args.profile.community)}

## The method

${renderMethod(args.method)}

## Analysis of this document

${JSON.stringify(args.analysis, null, 2)}

## Clinical assertions (the safety contract)

${args.assertions
  .map(
    (a) =>
      `${a.stableId} [${a.category}, ${a.strength}${a.isProtected ? `, PROTECTED ${a.protectedRuleIds.join("/")}` : ""}] ${a.text}`,
  )
  .join("\n")}

## Source document

<document>
${args.sourceText}
</document>
`.trim();
}

// ---------------------------------------------------------------------------
// Stage 4 — rewrite
// ---------------------------------------------------------------------------

export const rewritePrompt: PromptTemplate = { id: "rewrite", version: "1.0.0" };

export const rewriteSystem = `
You are executing an approved change plan against a source document.

You are not free to improve the document beyond the plan. Changes the plan does
not contain, and the method does not require, are defects — they cost a human
reviewer time and they are the route by which invented clinical content enters
a patient handout.

The never-soften rules override every other rule and every plan item.
`.trim();

export function buildRewritePrompt(args: {
  method: LoadedMethod;
  profile: Parameters<typeof renderProfile>[0];
  sourceText: string;
  planItems: { ordinal: number; ruleId: string; targetQuote: string; intent: string; rationale: string }[];
  assertions: Assertion[];
}): string {
  return `
Rewrite the document below according to the approved plan.

Output two things: the complete adapted document, and an itemised list of every
change you made.

Rules of rewriting:
- Execute the plan. Where a plan item cannot be executed without breaking a
  never-soften rule, do not execute it: keep the source wording and record a
  change with flagType CONSTRAINED_SECTION explaining the collision.
- Every clinical assertion listed below must survive with its meaning, its
  strength, its numbers, its units and its conditions intact.
- Record every difference between source and adaptation as a change, including
  ones the plan did not anticipate. An unrecorded change is invisible to review.
- Where a rule requires a flag rather than a change, emit the change with the
  matching flagType, beforeText as the source span, and afterText as the text
  you left in place. Do not invent the missing content.
- Cite a data-file entry ID on any substitution that comes from one.
- Do not add headings, summaries, encouragement, reassurance or attributions
  that the source does not contain.

## Target profile

${renderProfile(args.profile)}

## Permitted food substitutions

${renderFoodSubstitutions(args.method, args.profile.community)}

## Approved change plan

${args.planItems
  .map((i) => `${i.ordinal}. [${i.ruleId}] target: "${i.targetQuote}"\n   intent: ${i.intent}\n   why: ${i.rationale}`)
  .join("\n\n")}

## Clinical assertions that must survive

${args.assertions
  .map(
    (a) =>
      `${a.stableId} [${a.strength}${a.isProtected ? `, PROTECTED ${a.protectedRuleIds.join("/")}` : ""}] ${a.text}` +
      (a.conditions.length ? `\n    conditions: ${a.conditions.join(" | ")}` : "") +
      (a.numbers.length
        ? `\n    numbers: ${a.numbers.map((n) => `${n.direction} ${n.value} ${n.unit}`.trim()).join(", ")}`
        : ""),
  )
  .join("\n")}

## The method

${renderMethod(args.method)}

## Source document

<document>
${args.sourceText}
</document>
`.trim();
}

// ---------------------------------------------------------------------------
// Stage 5a — re-extract from the adaptation
// ---------------------------------------------------------------------------

export const verifyExtractPrompt: PromptTemplate = { id: "verify-extract", version: "1.0.0" };

export function buildVerifyExtractPrompt(args: { method: LoadedMethod; adaptedText: string }): string {
  return buildExtractPrompt({
    method: args.method,
    sourceText: args.adaptedText,
    label: "adapted text (independent extraction)",
  });
}

// ---------------------------------------------------------------------------
// Stage 5b — adversarial fidelity match
// ---------------------------------------------------------------------------

export const verifyMatchPrompt: PromptTemplate = { id: "verify-match", version: "1.0.0" };

export const verifyMatchSystem = `
You are a clinical fidelity auditor, and you are adversarial by design.

Your job is to find drift, not to confirm that the rewrite went well. Assume
drift is present and that it is subtle. The failures that matter here read
perfectly well: a dropped condition, a softened urgency word, a hedge that
disappeared, a threshold that acquired the word "about", a reassurance that was
never in the source.

You have not been told what the rewrite was trying to do, and you must not
speculate about it. Judge only what the two texts say.

If you are unsure whether something drifted, flag it. A false flag costs a
reviewer two minutes. A missed one goes into a patient's hands.
`.trim();

export function buildVerifyMatchPrompt(args: {
  sourceAssertions: Assertion[];
  adaptedAssertions: Assertion[];
  adaptedText: string;
}): string {
  return `
Compare the clinical claims of the source against the adapted text.

Produce one check per source assertion, and one additional check per claim that
appears in the adapted text but in no source assertion (verdict INVENTED,
sourceStableId empty).

Verdicts:
- PRESENT_UNCHANGED  same claim, same strength, same numbers, same conditions.
- MISSING            the claim does not appear in the adapted text at all.
- WEAKENED           urgency, obligation or certainty reduced; a hedge added.
- STRENGTHENED       urgency, obligation or certainty increased; a hedge removed.
- MEANING_ALTERED    the claim says something different.
- CONDITION_DROPPED  a condition that governed the claim is gone, or the claim
                     is now readable as unconditional.
- NUMBER_CHANGED     a value, a direction word, or a rounding changed.
- UNIT_CHANGED       a unit changed, was converted, or was dropped.
- INVENTED           a clinical claim in the adapted text that the source did
                     not make. This includes added reassurance, added reasons,
                     added attributions, and added specificity.

Check each of these explicitly, and say so in your explanation:
1. Is every condition still attached, and still readable as a condition?
2. Is the modal strength identical? Compare the actual words.
3. Is every number, unit and direction word identical?
4. Did any urgency word soften? ("immediately" to "soon", "call an ambulance"
   to "see your doctor")
5. Is there anything in the adapted text that a reader would take as a clinical
   claim and that the source does not support?

In huntNotes, say where you looked hardest and what you nearly flagged.

## Source assertions

${JSON.stringify(args.sourceAssertions, null, 2)}

## Assertions independently extracted from the adapted text

${JSON.stringify(args.adaptedAssertions, null, 2)}

## The adapted text in full

<document>
${args.adaptedText}
</document>
`.trim();
}

// ---------------------------------------------------------------------------
// Stage 6 — back-translation
// ---------------------------------------------------------------------------

export const backTranslatePrompt: PromptTemplate = { id: "back-translate", version: "1.0.0" };

export const backTranslateSystem = `
You are a literal back-translator. Render the text into English as closely as
the grammar allows.

Do not improve it. Do not tidy it. Do not resolve ambiguity in the direction the
author probably meant. If the text is awkward, the English should be awkward: a
back-translation exists to expose what the translation actually says, and a
fluent rendering hides exactly the drift it is there to find.
`.trim();

export function buildBackTranslatePrompt(args: { adaptedText: string; language: string }): string {
  return `
Translate the following ${args.language} text back into English, literally.

<document>
${args.adaptedText}
</document>
`.trim();
}
