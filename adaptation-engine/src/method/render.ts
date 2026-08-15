import { stringify as stringifyYaml } from "yaml";

import type { LoadedMethod, Profile, Rule } from "./types";

/**
 * Turns method files into prompt text. This is the only place rules become
 * prompt input, so there is exactly one answer to "what did the model actually
 * see?" — and StageRun.promptText records it per call.
 */

export function renderRule(rule: Rule): string {
  const lines: string[] = [];
  lines.push(`### ${rule.id} — ${rule.title}`);
  lines.push(`Status: ${rule.status}${rule.blocking ? " | BLOCKING" : ""}`);
  lines.push("");
  lines.push("Rule:");
  lines.push(rule.statement.trim());
  lines.push("");
  lines.push("Why:");
  lines.push(rule.rationale.trim());

  if (rule.example) {
    lines.push("");
    lines.push("Worked example:");
    for (const [key, value] of Object.entries(rule.example)) {
      lines.push(`  ${key}: ${String(value).trim().replace(/\n/g, "\n    ")}`);
    }
  }
  return lines.join("\n");
}

export function renderRules(rules: Rule[]): string {
  return rules.map(renderRule).join("\n\n");
}

/** Every dimension, in manifest order. Optionally excluding some. */
export function renderMethod(method: LoadedMethod, excludeDimensions: string[] = []): string {
  return method.dimensions
    .filter((dim) => !excludeDimensions.includes(dim.id))
    .map((dim) => `## ${dim.label}\n\n${renderRules(dim.rules)}`)
    .join("\n\n");
}

/** The safety spine on its own. Used by stages that must not see the plan. */
export function renderNeverSoften(method: LoadedMethod): string {
  const dim = method.dimensions.find((d) => d.id === "never-soften");
  if (!dim) throw new Error("Method has no never-soften dimension");
  return renderRules(dim.rules);
}

export function renderProfile(profile: {
  key?: string;
  label: string;
  language: string;
  translate: boolean;
  readingLevelTarget: string;
  readingLevelCeiling: string;
  addresseeMode: string;
  community: string | null;
  messenger: string | null;
}): string {
  return [
    `Label: ${profile.label}`,
    `Language: ${profile.language}${profile.translate ? " (translation required)" : " (no translation)"}`,
    `Reading level target: ${profile.readingLevelTarget}`,
    `Reading level hard ceiling: ${profile.readingLevelCeiling}`,
    `Addressee mode (ADR-01): ${profile.addresseeMode}`,
    `Community: ${profile.community ?? "NOT SET — community-specific rules cannot fire"}`,
    `Messenger (TRUST-01): ${profile.messenger ?? "NOT SET — do not name a messenger"}`,
  ].join("\n");
}

/**
 * The substitution list as the rewrite stage sees it: only the entries that are
 * actually usable, plus an explicit statement when none are. FOOD-01 permits
 * substitution only from a signed-off list, so an unsigned list has to reach
 * the model as a prohibition rather than as an absence.
 */
export function renderFoodSubstitutions(method: LoadedMethod, community: string | null): string {
  const data = method.data["food-substitutions"] as
    | {
        communities?: { id: string; label?: string; signed_off?: boolean }[];
        entries?: { id: string; community: string; status?: string }[];
      }
    | undefined;

  if (!community) {
    return "The target profile has no community set. No food substitution may fire. Flag every food example with FOOD_SUBSTITUTION_NEEDED (FOOD-02).";
  }

  const communityRecord = (data?.communities ?? []).find((c) => c.id === community);
  if (!communityRecord?.signed_off) {
    return `The substitution list is not signed off for community "${community}". No food substitution may fire. Flag every food example with FOOD_SUBSTITUTION_NEEDED (FOOD-02).`;
  }

  const entries = (data?.entries ?? []).filter(
    (e) => e.community === community && e.status === "signed_off",
  );
  if (entries.length === 0) {
    return `No signed-off entries exist for community "${community}". Flag every food example with FOOD_SUBSTITUTION_NEEDED (FOOD-02).`;
  }

  return [
    "These are the only permitted food substitutions. Cite the entry id on every substitution you make.",
    "",
    stringifyYaml(entries).trim(),
  ].join("\n");
}

export function profileFromManifest(method: LoadedMethod, key: string): Profile {
  const profile = method.manifest.profiles.find((p) => p.id === key);
  if (!profile) {
    const available = method.manifest.profiles.map((p) => p.id).join(", ");
    throw new Error(`No profile "${key}" in method.yaml. Available: ${available}`);
  }
  return profile;
}
