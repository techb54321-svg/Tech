import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";

import { prisma } from "./db";
import { requireEnv } from "./env";

/**
 * Every model call in this system goes through here, and every call writes a
 * StageRun row before it is made and updates it after. There is deliberately no
 * way to call the API without leaving that record: the audit trail is not a
 * feature of the pipeline, it is the shape of the pipeline.
 *
 * Structured output is obtained by forcing a single tool call rather than by
 * asking for JSON in prose. The raw response is stored either way, so a parsing
 * change later can be replayed against what the model actually returned.
 */

let client: Anthropic | undefined;
function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
  return client;
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export interface StageCall<T> {
  runId: string;
  /** EXTRACT | ANALYSE | PLAN | REWRITE | VERIFY_EXTRACT | VERIFY_MATCH | ... */
  stage: string;
  promptTemplateId: string;
  promptTemplateVersion: string;
  system: string;
  prompt: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  toolName: string;
  toolDescription: string;
  /** JSON Schema for the forced tool call. */
  inputSchema: Record<string, unknown>;
  /** Validates and narrows the tool input. Throws on drift from the schema. */
  parse: (raw: unknown) => T;
  /** Stored verbatim as StageRun.inputJson — what this stage was given. */
  input: unknown;
}

export interface StageResult<T> {
  result: T;
  stageRunId: string;
  attempt: number;
}

async function nextAttempt(runId: string, stage: string): Promise<number> {
  const previous = await prisma.stageRun.findFirst({
    where: { runId, stage },
    orderBy: { attempt: "desc" },
    select: { attempt: true },
  });
  return (previous?.attempt ?? 0) + 1;
}

export async function callStage<T>(call: StageCall<T>): Promise<StageResult<T>> {
  const attempt = await nextAttempt(call.runId, call.stage);
  const maxTokens = call.maxTokens ?? 8000;
  const temperature = call.temperature ?? 0;

  const stageRun = await prisma.stageRun.create({
    data: {
      runId: call.runId,
      stage: call.stage,
      attempt,
      status: "RUNNING",
      promptTemplateId: call.promptTemplateId,
      promptTemplateVersion: call.promptTemplateVersion,
      promptText: call.prompt,
      promptSha256: sha256(call.prompt),
      systemPromptText: call.system,
      model: call.model,
      temperature,
      maxTokens,
      inputJson: JSON.stringify(call.input),
    },
  });

  try {
    const response = await anthropic().messages.create({
      model: call.model,
      max_tokens: maxTokens,
      temperature,
      system: call.system,
      messages: [{ role: "user", content: call.prompt }],
      tools: [
        {
          name: call.toolName,
          description: call.toolDescription,
          input_schema: call.inputSchema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: call.toolName },
    });

    const rawResponse = JSON.stringify(response, null, 2);
    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error(
        `${call.stage} did not return a ${call.toolName} tool call. Stop reason: ${response.stop_reason}.`,
      );
    }

    const result = call.parse(toolUse.input);

    await prisma.stageRun.update({
      where: { id: stageRun.id },
      data: {
        status: "OK",
        outputJson: JSON.stringify(result),
        rawResponse,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        finishedAt: new Date(),
      },
    });

    return { result, stageRunId: stageRun.id, attempt };
  } catch (err) {
    await prisma.stageRun.update({
      where: { id: stageRun.id },
      data: {
        status: "FAILED",
        errorText: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
        finishedAt: new Date(),
      },
    });
    throw err;
  }
}

/**
 * Record a stage that was deliberately not run, so the governance record can
 * show it was considered rather than leaving a silent gap. Used for
 * back-translation on English-only profiles.
 */
export async function recordSkippedStage(
  runId: string,
  stage: string,
  reason: string,
): Promise<void> {
  const attempt = await nextAttempt(runId, stage);
  await prisma.stageRun.create({
    data: {
      runId,
      stage,
      attempt,
      status: "OK",
      promptTemplateId: "skipped",
      promptTemplateVersion: "-",
      promptText: "",
      promptSha256: sha256(""),
      model: "none",
      inputJson: JSON.stringify({ skipped: true, reason }),
      outputJson: JSON.stringify({ skipped: true, reason }),
      finishedAt: new Date(),
    },
  });
}
