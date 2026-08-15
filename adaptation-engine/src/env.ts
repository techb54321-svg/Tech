import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Minimal .env loader for the CLI. Next.js loads .env.local itself, so this
 * only matters when running scripts/ directly. Deliberately dependency-free:
 * one fewer package in a tree that will be read by people auditing it.
 *
 * Precedence: real process env wins, then .env.local, then .env.
 */
function loadFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

let loaded = false;
export function loadEnv() {
  if (loaded) return;
  loaded = true;
  loadFile(join(process.cwd(), ".env.local"));
  loadFile(join(process.cwd(), ".env"));
}

loadEnv();

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

/** Model used by extract / analyse / plan / rewrite. */
export const adaptationModel = () => process.env.ADAPTATION_MODEL ?? "claude-sonnet-5";

/** Model used by verify / back-translate. See DECISIONS.md, D-15. */
export const fidelityModel = () => process.env.FIDELITY_MODEL ?? adaptationModel();
