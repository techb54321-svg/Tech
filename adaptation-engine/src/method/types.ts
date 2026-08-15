import { z } from "zod";

/**
 * Shapes of the method files. These schemas exist so that a typo in a rule
 * file fails loudly at load time rather than quietly producing an adaptation
 * that skipped a rule.
 *
 * The schemas are deliberately permissive about extra keys: rule files carry
 * per-rule extras (seed lists, known-cost notes, worked counter-examples) and
 * the method author must be able to add more without a code change.
 */

export const RULE_STATUSES = ["confirmed", "assumed", "strawman"] as const;
export type RuleStatus = (typeof RULE_STATUSES)[number];

export const RuleSchema = z
  .object({
    id: z.string().regex(/^[A-Z]+-\d{2,}$/, "rule id must look like NUM-01"),
    title: z.string().min(1),
    status: z.enum(RULE_STATUSES),
    source: z.string().min(1),
    statement: z.string().min(1),
    rationale: z.string().min(1),
    tier: z.number().int().optional(),
    blocking: z.boolean().optional(),
    // Worked examples. Keys vary by rule (before / after / wrong /
    // after_INDIVIDUAL / note ...), so this is a loose string map.
    example: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

export type Rule = z.infer<typeof RuleSchema> & { dimension: string };

export const RuleFileSchema = z
  .object({
    dimension: z.string().min(1),
    label: z.string().min(1),
    prefix: z.string().regex(/^[A-Z]+$/),
    version: z.string().min(1),
    description: z.string().optional(),
    rules: z.array(RuleSchema).min(1),
  })
  .passthrough();

export type RuleFile = z.infer<typeof RuleFileSchema>;

export const ProfileSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    status: z.enum(RULE_STATUSES),
    language: z.string().min(1),
    translate: z.boolean(),
    reading_level_target: z.string().min(1),
    reading_level_hard_ceiling: z.string().min(1),
    addressee_mode: z.enum([
      "INDIVIDUAL",
      "FAMILY_INCLUSIVE",
      "HOUSEHOLD_DECISION_MAKER",
    ]),
    community: z.string().nullable(),
    messenger: z.string().nullable(),
    notes: z.string().optional(),
  })
  .passthrough();

export type Profile = z.infer<typeof ProfileSchema>;

export const ManifestSchema = z
  .object({
    method_version: z.string().min(1),
    status: z.enum(["draft", "active", "superseded"]),
    author: z.string().nullable(),
    adopted_on: z.string().nullable(),
    summary: z.string().min(1),
    statuses: z.record(z.string(), z.string()),
    dimensions: z
      .array(
        z.object({
          id: z.string().min(1),
          label: z.string().min(1),
          file: z.string().min(1),
          prefix: z.string().regex(/^[A-Z]+$/),
        }),
      )
      .min(1),
    data_files: z.array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        file: z.string().min(1),
      }),
    ),
    profiles: z.array(ProfileSchema).min(1),
  })
  .passthrough();

export type Manifest = z.infer<typeof ManifestSchema>;

export interface LoadedDimension {
  id: string;
  label: string;
  file: string;
  prefix: string;
  ruleFile: RuleFile;
  rules: Rule[];
}

export interface LoadedMethod {
  /** Absolute path of the method directory that was loaded. */
  root: string;
  manifest: Manifest;
  dimensions: LoadedDimension[];
  /** Parsed supporting data files, keyed by manifest data_file id. */
  data: Record<string, unknown>;
  /** Every method file's raw text, keyed by path relative to the method dir. */
  files: Record<string, string>;
  /** SHA-256 over every file, in path order. Identifies the exact method. */
  methodSha256: string;
  rules: Rule[];
  ruleCount: number;
  statusCounts: Record<RuleStatus, number>;
}
