import { z } from "zod";

/**
 * Stage output contracts. Each has a zod schema (used to validate what came
 * back) and a JSON Schema (given to the model as a forced tool call). They are
 * written out by hand and kept next to each other on purpose: this pair is the
 * interface between the model and the database, and it should be readable
 * without running a generator.
 *
 * Where a field is optional, the encoding is a sentinel rather than null —
 * "NONE" or "" or 0 — because sentinels survive the round trip through tool
 * calls more reliably than nulls do.
 */

export const ASSERTION_CATEGORIES = [
  "DOSE",
  "THRESHOLD",
  "WARNING_SIGN",
  "ACTION",
  "CONTRAINDICATION",
  "TIMEFRAME",
  "RISK_STATEMENT",
  "ELIGIBILITY",
  "OTHER",
] as const;

export const STRENGTHS = ["MUST", "SHOULD", "MAY", "STATEMENT"] as const;

export const AssertionSchema = z.object({
  stableId: z.string(),
  category: z.enum(ASSERTION_CATEGORIES),
  text: z.string(),
  verbatimQuote: z.string(),
  strength: z.enum(STRENGTHS),
  numbers: z.array(
    z.object({
      value: z.string(),
      unit: z.string(),
      direction: z.string(),
    }),
  ),
  conditions: z.array(z.string()),
  isProtected: z.boolean(),
  protectedRuleIds: z.array(z.string()),
});

export type Assertion = z.infer<typeof AssertionSchema>;

export const ExtractOutputSchema = z.object({
  assertions: z.array(AssertionSchema),
});
export type ExtractOutput = z.infer<typeof ExtractOutputSchema>;

export const extractJsonSchema = {
  type: "object",
  properties: {
    assertions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          stableId: { type: "string", description: "CA-001, CA-002, ... in document order." },
          category: { type: "string", enum: [...ASSERTION_CATEGORIES] },
          text: {
            type: "string",
            description: "The claim restated as one atomic sentence, including every condition.",
          },
          verbatimQuote: {
            type: "string",
            description: "The exact span from the document this claim came from. Copy it character for character.",
          },
          strength: { type: "string", enum: [...STRENGTHS] },
          numbers: {
            type: "array",
            description: "Every number in the claim, with its unit and its direction word.",
            items: {
              type: "object",
              properties: {
                value: { type: "string" },
                unit: { type: "string", description: "mmHg, mmol/L, mg, minutes, people, or empty." },
                direction: {
                  type: "string",
                  description: "under, over, at least, no more than, within, exactly, or empty.",
                },
              },
              required: ["value", "unit", "direction"],
            },
          },
          conditions: {
            type: "array",
            description: "Each condition that governs this claim, one per item. Empty if unconditional.",
            items: { type: "string" },
          },
          isProtected: {
            type: "boolean",
            description: "True if any never-soften rule applies to this claim.",
          },
          protectedRuleIds: {
            type: "array",
            items: { type: "string" },
            description: "The NS rule IDs that apply, e.g. NS-02. Empty if none.",
          },
        },
        required: [
          "stableId",
          "category",
          "text",
          "verbatimQuote",
          "strength",
          "numbers",
          "conditions",
          "isProtected",
          "protectedRuleIds",
        ],
      },
    },
  },
  required: ["assertions"],
} as const;

// ---------------------------------------------------------------------------

export const AnalysisOutputSchema = z.object({
  addressee: z.object({
    observed: z.enum(["INDIVIDUAL", "FAMILY_INCLUSIVE", "HOUSEHOLD_DECISION_MAKER", "IMPERSONAL"]),
    evidence: z.string(),
  }),
  riskStatements: z.array(
    z.object({
      quote: z.string(),
      format: z.enum([
        "PERCENTAGE",
        "NATURAL_FREQUENCY",
        "ONE_IN_X",
        "RELATIVE_RISK",
        "QUALITATIVE",
        "OTHER",
      ]),
      hasComparisonGroup: z.boolean(),
      hasTimeframe: z.boolean(),
      absoluteNumbersPresentInDocument: z.boolean(),
      note: z.string(),
    }),
  ),
  culturalAssumptions: z.array(
    z.object({ quote: z.string(), assumption: z.string(), dimension: z.string() }),
  ),
  idioms: z.array(
    z.object({ quote: z.string(), literalReading: z.string(), whyItFails: z.string() }),
  ),
  jargon: z.array(
    z.object({
      term: z.string(),
      quote: z.string(),
      definedInSource: z.boolean(),
      recommendedHandling: z.enum(["REPLACE", "KEEP_AND_DEFINE"]),
    }),
  ),
  mealtimeAssumptions: z.array(z.object({ quote: z.string(), assumption: z.string() })),
  framingProblems: z.array(
    z.object({ quote: z.string(), kind: z.enum(["FATALISM", "BLAME", "OVERPROMISE", "EXHORTATION"]) }),
  ),
  attributions: z.array(z.object({ quote: z.string(), namedSource: z.string() })),
  overallNotes: z.string(),
});
export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>;

export const analyseJsonSchema = {
  type: "object",
  properties: {
    addressee: {
      type: "object",
      properties: {
        observed: {
          type: "string",
          enum: ["INDIVIDUAL", "FAMILY_INCLUSIVE", "HOUSEHOLD_DECISION_MAKER", "IMPERSONAL"],
        },
        evidence: { type: "string" },
      },
      required: ["observed", "evidence"],
    },
    riskStatements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          quote: { type: "string" },
          format: {
            type: "string",
            enum: ["PERCENTAGE", "NATURAL_FREQUENCY", "ONE_IN_X", "RELATIVE_RISK", "QUALITATIVE", "OTHER"],
          },
          hasComparisonGroup: { type: "boolean" },
          hasTimeframe: { type: "boolean" },
          absoluteNumbersPresentInDocument: {
            type: "boolean",
            description:
              "For a relative risk: does this document contain the absolute numbers needed to convert it? Decides whether NUM-03 applies.",
          },
          note: { type: "string" },
        },
        required: [
          "quote",
          "format",
          "hasComparisonGroup",
          "hasTimeframe",
          "absoluteNumbersPresentInDocument",
          "note",
        ],
      },
    },
    culturalAssumptions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          quote: { type: "string" },
          assumption: { type: "string" },
          dimension: { type: "string", description: "Which method dimension this belongs to." },
        },
        required: ["quote", "assumption", "dimension"],
      },
    },
    idioms: {
      type: "array",
      items: {
        type: "object",
        properties: {
          quote: { type: "string" },
          literalReading: { type: "string", description: "What a literal reader understands." },
          whyItFails: { type: "string" },
        },
        required: ["quote", "literalReading", "whyItFails"],
      },
    },
    jargon: {
      type: "array",
      items: {
        type: "object",
        properties: {
          term: { type: "string" },
          quote: { type: "string" },
          definedInSource: { type: "boolean" },
          recommendedHandling: { type: "string", enum: ["REPLACE", "KEEP_AND_DEFINE"] },
        },
        required: ["term", "quote", "definedInSource", "recommendedHandling"],
      },
    },
    mealtimeAssumptions: {
      type: "array",
      items: {
        type: "object",
        properties: { quote: { type: "string" }, assumption: { type: "string" } },
        required: ["quote", "assumption"],
      },
    },
    framingProblems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          quote: { type: "string" },
          kind: { type: "string", enum: ["FATALISM", "BLAME", "OVERPROMISE", "EXHORTATION"] },
        },
        required: ["quote", "kind"],
      },
    },
    attributions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          quote: { type: "string" },
          namedSource: { type: "string", description: "The named body, or empty if unattributed." },
        },
        required: ["quote", "namedSource"],
      },
    },
    overallNotes: { type: "string" },
  },
  required: [
    "addressee",
    "riskStatements",
    "culturalAssumptions",
    "idioms",
    "jargon",
    "mealtimeAssumptions",
    "framingProblems",
    "attributions",
    "overallNotes",
  ],
} as const;

// ---------------------------------------------------------------------------

export const PlanOutputSchema = z.object({
  items: z.array(
    z.object({
      ordinal: z.number().int(),
      ruleId: z.string(),
      targetQuote: z.string(),
      intent: z.string(),
      rationale: z.string(),
      touchesAssertionIds: z.array(z.string()),
    }),
  ),
});
export type PlanOutput = z.infer<typeof PlanOutputSchema>;

export const planJsonSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ordinal: { type: "integer", description: "1-based, in document order." },
          ruleId: { type: "string", description: "The method rule that requires this change, e.g. NUM-01." },
          targetQuote: { type: "string", description: "The exact source text this will act on." },
          intent: { type: "string", description: "What will change. Concrete, not 'improve clarity'." },
          rationale: { type: "string", description: "Why, in language the reviewer reads." },
          touchesAssertionIds: {
            type: "array",
            items: { type: "string" },
            description: "Clinical assertion IDs this change would touch, e.g. CA-004.",
          },
        },
        required: ["ordinal", "ruleId", "targetQuote", "intent", "rationale", "touchesAssertionIds"],
      },
    },
  },
  required: ["items"],
} as const;

// ---------------------------------------------------------------------------

export const FLAG_TYPES = [
  "NONE",
  "FOOD_SUBSTITUTION_NEEDED",
  "PORTION_EQUIVALENCE_MISSING",
  "MEALTIME_ASSUMPTION",
  "NEEDS_PRESCRIBER_INPUT",
  "RELATIVE_RISK_CARRIED",
  "MISSING_DENOMINATOR_CONTEXT",
  "REASON_ABSENT_IN_SOURCE",
  "CONSTRAINED_SECTION",
] as const;

export const RewriteOutputSchema = z.object({
  adaptedText: z.string(),
  changes: z.array(
    z.object({
      ordinal: z.number().int(),
      ruleId: z.string(),
      planItemOrdinal: z.number().int(),
      beforeText: z.string(),
      afterText: z.string(),
      rationalePlain: z.string(),
      flagType: z.enum(FLAG_TYPES),
      citesDataEntryId: z.string(),
      touchesAssertionIds: z.array(z.string()),
    }),
  ),
});
export type RewriteOutput = z.infer<typeof RewriteOutputSchema>;

export const rewriteJsonSchema = {
  type: "object",
  properties: {
    adaptedText: {
      type: "string",
      description: "The complete adapted document in markdown. No commentary.",
    },
    changes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ordinal: { type: "integer", description: "1-based, in adapted-document order." },
          ruleId: { type: "string" },
          planItemOrdinal: {
            type: "integer",
            description: "The plan item this executes, or 0 if it was not in the plan.",
          },
          beforeText: { type: "string", description: "Exact source text. Empty for pure additions." },
          afterText: { type: "string", description: "Exact adapted text. Empty for deletions." },
          rationalePlain: { type: "string" },
          flagType: {
            type: "string",
            enum: [...FLAG_TYPES],
            description: "NONE for an ordinary change; otherwise the flag raised instead of changing.",
          },
          citesDataEntryId: {
            type: "string",
            description: "Data-file entry cited, e.g. FS-014. Empty if none.",
          },
          touchesAssertionIds: { type: "array", items: { type: "string" } },
        },
        required: [
          "ordinal",
          "ruleId",
          "planItemOrdinal",
          "beforeText",
          "afterText",
          "rationalePlain",
          "flagType",
          "citesDataEntryId",
          "touchesAssertionIds",
        ],
      },
    },
  },
  required: ["adaptedText", "changes"],
} as const;

// ---------------------------------------------------------------------------

export const VERDICTS = [
  "PRESENT_UNCHANGED",
  "MISSING",
  "WEAKENED",
  "STRENGTHENED",
  "MEANING_ALTERED",
  "CONDITION_DROPPED",
  "NUMBER_CHANGED",
  "UNIT_CHANGED",
  "INVENTED",
] as const;

export const VerifyOutputSchema = z.object({
  checks: z.array(
    z.object({
      sourceStableId: z.string(),
      adaptedStableId: z.string(),
      verdict: z.enum(VERDICTS),
      explanation: z.string(),
      evidenceQuote: z.string(),
      ruleIds: z.array(z.string()),
    }),
  ),
  huntNotes: z.string(),
});
export type VerifyOutput = z.infer<typeof VerifyOutputSchema>;

export const verifyJsonSchema = {
  type: "object",
  properties: {
    checks: {
      type: "array",
      description: "One entry per source assertion, plus one per invented assertion.",
      items: {
        type: "object",
        properties: {
          sourceStableId: {
            type: "string",
            description: "The source assertion ID, or empty when the verdict is INVENTED.",
          },
          adaptedStableId: {
            type: "string",
            description: "The matching assertion ID from the adapted text, or empty if none.",
          },
          verdict: { type: "string", enum: [...VERDICTS] },
          explanation: {
            type: "string",
            description: "State the drift precisely. For PRESENT_UNCHANGED, say what you checked.",
          },
          evidenceQuote: { type: "string", description: "The adapted text you are judging." },
          ruleIds: {
            type: "array",
            items: { type: "string" },
            description: "Never-soften rule IDs implicated, e.g. NS-02.",
          },
        },
        required: ["sourceStableId", "adaptedStableId", "verdict", "explanation", "evidenceQuote", "ruleIds"],
      },
    },
    huntNotes: {
      type: "string",
      description: "Where you looked hardest and what you nearly flagged. Be specific.",
    },
  },
  required: ["checks", "huntNotes"],
} as const;

// ---------------------------------------------------------------------------

export const BackTranslationOutputSchema = z.object({ backTranslatedText: z.string() });
export type BackTranslationOutput = z.infer<typeof BackTranslationOutputSchema>;

export const backTranslationJsonSchema = {
  type: "object",
  properties: {
    backTranslatedText: {
      type: "string",
      description: "A literal English translation. Do not improve, tidy or explain.",
    },
  },
  required: ["backTranslatedText"],
} as const;
