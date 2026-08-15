/**
 * Validate the method files and print what state the method is in.
 *
 *   npm run method:check
 *
 * Run this after editing anything under method/. It is the fastest way to see
 * which rules are still the engine author's guesses rather than yours.
 */

import { loadMethod, MethodError } from "../src/method/loader";

function main() {
  let method;
  try {
    method = loadMethod();
  } catch (err) {
    if (err instanceof MethodError) {
      console.error(`\nMethod is not valid:\n\n${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }

  const { manifest, statusCounts, ruleCount } = method;

  console.log("");
  console.log(`Method version   ${manifest.method_version}  (${manifest.status})`);
  console.log(`Author           ${manifest.author ?? "NOT SET — set author in method/method.yaml"}`);
  console.log(`Content hash     ${method.methodSha256}`);
  console.log(`Rules            ${ruleCount} across ${method.dimensions.length} dimensions`);
  console.log(
    `                 ${statusCounts.confirmed} confirmed, ` +
      `${statusCounts.assumed} assumed, ${statusCounts.strawman} strawman`,
  );
  console.log("");

  for (const dim of method.dimensions) {
    const counts = dim.rules.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});
    const summary = ["confirmed", "assumed", "strawman"]
      .filter((s) => counts[s])
      .map((s) => `${counts[s]} ${s}`)
      .join(", ");
    console.log(`  ${dim.label.padEnd(38)} ${String(dim.rules.length).padStart(2)} rules  (${summary})`);
  }

  const unconfirmed = method.rules.filter((r) => r.status !== "confirmed");
  if (unconfirmed.length > 0) {
    console.log("");
    console.log(`Rules awaiting your decision (${unconfirmed.length}):`);
    console.log("");
    for (const rule of unconfirmed) {
      const marker = rule.status === "strawman" ? "?" : "~";
      console.log(`  ${marker} ${rule.id.padEnd(9)} ${rule.title}`);
    }
    console.log("");
    console.log("  ?  strawman — written by the engine author, you have not confirmed it");
    console.log("  ~  assumed  — proposed to you as a default, not objected to");
  }

  const blocking = method.rules.filter((r) => r.blocking === true);
  console.log("");
  console.log(`Blocking rules (${blocking.length}): ${blocking.map((r) => r.id).join(", ")}`);

  const todos: string[] = [];
  if (!manifest.author) todos.push("method.yaml: author is not set");
  for (const profile of manifest.profiles) {
    if (!profile.community) todos.push(`profile ${profile.id}: community is not named (food rules cannot fire)`);
    if (!profile.messenger) todos.push(`profile ${profile.id}: messenger is not set (TRUST-01 cannot fire)`);
  }
  const substitutions = method.data["food-substitutions"] as
    | { communities?: { id: string; signed_off?: boolean }[]; entries?: unknown[] }
    | undefined;
  const signedOff = (substitutions?.communities ?? []).filter((c) => c.signed_off).length;
  if (signedOff === 0) {
    todos.push("food-substitutions.yaml: no community is signed off, so every food example will be flagged");
  }

  if (todos.length > 0) {
    console.log("");
    console.log("Open items:");
    for (const todo of todos) console.log(`  - ${todo}`);
  }
  console.log("");
}

main();
