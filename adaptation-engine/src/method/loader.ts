import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { parse as parseYaml } from "yaml";

import {
  LoadedDimension,
  LoadedMethod,
  ManifestSchema,
  RULE_STATUSES,
  Rule,
  RuleFileSchema,
  RuleStatus,
} from "./types";

export const DEFAULT_METHOD_ROOT = join(process.cwd(), "method");

export class MethodError extends Error {}

/** Every .yaml file under the method directory, as paths relative to it. */
function listYamlFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir).sort()) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry.endsWith(".yaml") || entry.endsWith(".yml")) {
        found.push(relative(root, full).split(sep).join("/"));
      }
    }
  };
  walk(root);
  return found.sort();
}

function readYaml(root: string, relPath: string): { raw: string; parsed: unknown } {
  let raw: string;
  try {
    raw = readFileSync(join(root, relPath), "utf8");
  } catch {
    throw new MethodError(`Method file listed in method.yaml but missing on disk: ${relPath}`);
  }
  try {
    return { raw, parsed: parseYaml(raw) };
  } catch (err) {
    throw new MethodError(`${relPath} is not valid YAML: ${(err as Error).message}`);
  }
}

/**
 * Load, validate and hash the method.
 *
 * Validation is strict on purpose. A rule file that does not parse, a rule ID
 * that collides, or a file on disk that the manifest does not list are all
 * errors: silently skipping any of them would mean an adaptation ran against a
 * method that is not the one written down, which is the single failure this
 * whole system exists to prevent.
 */
export function loadMethod(root: string = DEFAULT_METHOD_ROOT): LoadedMethod {
  const files: Record<string, string> = {};
  files["method.yaml"] = readYaml(root, "method.yaml").raw;

  const method = parseMethod(files, root, (relPath) => {
    const { raw } = readYaml(root, relPath);
    return raw;
  });

  const orphans = listYamlFiles(root).filter((f) => !(f in method.files));
  if (orphans.length > 0) {
    throw new MethodError(
      `These method files exist on disk but are not listed in method.yaml, so no ` +
        `adaptation would ever use them:\n  ${orphans.join("\n  ")}\n` +
        `Add them under "dimensions:" or "data_files:", or delete them.`,
    );
  }

  return method;
}

/**
 * Re-load a method from a stored MethodSnapshot, so a pipeline stage re-run
 * months later executes the rules that were in force at the time rather than
 * whatever the files say today.
 */
export function loadMethodFromSnapshot(filesJson: string): LoadedMethod {
  const files = JSON.parse(filesJson) as Record<string, string>;
  return parseMethod({ "method.yaml": files["method.yaml"] }, "<snapshot>", (relPath) => {
    const raw = files[relPath];
    if (raw === undefined) {
      throw new MethodError(`Method snapshot is missing ${relPath}`);
    }
    return raw;
  });
}

/**
 * Shared validation over a set of method files, however they were obtained.
 * `readRelative` supplies file text on demand so this works identically
 * against the disk and against a stored snapshot.
 */
function parseMethod(
  seedFiles: Record<string, string>,
  root: string,
  readRelative: (relPath: string) => string,
): LoadedMethod {
  const files: Record<string, string> = { ...seedFiles };

  const manifestRaw = files["method.yaml"];
  if (manifestRaw === undefined) throw new MethodError("method.yaml is missing");

  let manifestParsed: unknown;
  try {
    manifestParsed = parseYaml(manifestRaw);
  } catch (err) {
    throw new MethodError(`method.yaml is not valid YAML: ${(err as Error).message}`);
  }

  const manifestResult = ManifestSchema.safeParse(manifestParsed);
  if (!manifestResult.success) {
    throw new MethodError(`method.yaml is invalid:\n${formatIssues(manifestResult.error)}`);
  }
  const manifest = manifestResult.data;

  const dimensions: LoadedDimension[] = [];
  const rules: Rule[] = [];
  const seenIds = new Map<string, string>();

  const take = (relPath: string): unknown => {
    const raw = readRelative(relPath);
    files[relPath] = raw;
    try {
      return parseYaml(raw);
    } catch (err) {
      throw new MethodError(`${relPath} is not valid YAML: ${(err as Error).message}`);
    }
  };

  for (const dim of manifest.dimensions) {
    const parsedFile = RuleFileSchema.safeParse(take(dim.file));
    if (!parsedFile.success) {
      throw new MethodError(`${dim.file} is invalid:\n${formatIssues(parsedFile.error)}`);
    }
    const ruleFile = parsedFile.data;

    if (ruleFile.prefix !== dim.prefix) {
      throw new MethodError(
        `${dim.file} declares prefix "${ruleFile.prefix}" but method.yaml says "${dim.prefix}"`,
      );
    }
    if (ruleFile.dimension !== dim.id) {
      throw new MethodError(
        `${dim.file} declares dimension "${ruleFile.dimension}" but method.yaml says "${dim.id}"`,
      );
    }

    const dimRules: Rule[] = ruleFile.rules.map((rule) => {
      if (!rule.id.startsWith(`${dim.prefix}-`)) {
        throw new MethodError(
          `Rule ${rule.id} in ${dim.file} does not use the dimension's prefix "${dim.prefix}"`,
        );
      }
      const previous = seenIds.get(rule.id);
      if (previous) {
        throw new MethodError(
          `Rule ID ${rule.id} appears in both ${previous} and ${dim.file}. ` +
            `Rule IDs are permanent and must never be reused.`,
        );
      }
      seenIds.set(rule.id, dim.file);
      return { ...rule, dimension: dim.id };
    });

    rules.push(...dimRules);
    dimensions.push({ ...dim, ruleFile, rules: dimRules });
  }

  const data: Record<string, unknown> = {};
  for (const dataFile of manifest.data_files) {
    data[dataFile.id] = take(dataFile.file);
  }

  const statusCounts = Object.fromEntries(
    RULE_STATUSES.map((s) => [s, rules.filter((r) => r.status === s).length]),
  ) as Record<RuleStatus, number>;

  return {
    root,
    manifest,
    dimensions,
    data,
    files,
    methodSha256: hashFiles(files),
    rules,
    ruleCount: rules.length,
    statusCounts,
  };
}

/**
 * Content hash of the whole method, in path order. Recorded on every run so an
 * edit made without bumping method_version is still detectable.
 */
export function hashFiles(files: Record<string, string>): string {
  const hash = createHash("sha256");
  for (const path of Object.keys(files).sort()) {
    hash.update(path);
    hash.update("\0");
    hash.update(files[path]);
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function findRule(method: LoadedMethod, ruleId: string): Rule | undefined {
  return method.rules.find((r) => r.id === ruleId);
}

/** Rules that block a document when violated. */
export function blockingRules(method: LoadedMethod): Rule[] {
  return method.rules.filter((r) => r.blocking === true);
}

function formatIssues(error: { issues: { path: (string | number)[]; message: string }[] }): string {
  return error.issues
    .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}
