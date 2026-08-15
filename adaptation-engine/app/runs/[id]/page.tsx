import Link from "next/link";

import { prisma } from "../../../src/db";
import { analyseReadability } from "../../../src/readability";
import { continuePipeline, removePlanItem, rerunStage, resolveCheck, startPipeline } from "../../actions";
import { Badge, Button, Card, Crumbs, Empty, RuleTag, inputClass, statusTone } from "../../ui";

export const dynamic = "force-dynamic";

const STAGES = [
  { key: "EXTRACT", label: "1 Extract", blurb: "Atomic clinical claims. This list is the safety contract." },
  { key: "ANALYSE", label: "2 Analyse", blurb: "Reading level, risk format, addressee, culture, idiom, jargon." },
  { key: "PLAN", label: "3 Plan", blurb: "Which rules fire and what each will change — before any rewriting." },
  { key: "REWRITE", label: "4 Rewrite", blurb: "Execute the approved plan." },
  { key: "VERIFY", label: "5 Verify", blurb: "Re-extract and hunt for drift, with no sight of the plan." },
  { key: "BACKTRANSLATE", label: "6 Back-translate", blurb: "Translate back and diff again. Skipped when not translating." },
];

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const run = await prisma.adaptationRun.findUniqueOrThrow({
    where: { id },
    include: {
      sourceDocument: true,
      targetProfile: true,
      methodSnapshot: true,
      stages: { orderBy: [{ startedAt: "asc" }] },
      planItems: { orderBy: { ordinal: "asc" } },
      checks: { include: { sourceAssertion: true }, orderBy: { createdAt: "asc" } },
      assertions: { where: { origin: "SOURCE" }, orderBy: { stableId: "asc" } },
      _count: { select: { changes: true } },
    },
  });

  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const openFlags = run.checks.filter((c) => c.blocking && c.resolutionStatus === "OPEN");
  const sourceReadability = analyseReadability(run.sourceDocument.sourceText);
  const adaptedReadability = run.adaptedText ? analyseReadability(run.adaptedText) : null;

  const latestByStage = new Map<string, (typeof run.stages)[number]>();
  for (const s of run.stages) {
    const existing = latestByStage.get(s.stage);
    if (!existing || s.attempt >= existing.attempt) latestByStage.set(s.stage, s);
  }

  return (
    <div className="space-y-6">
      <Crumbs
        items={[
          { href: "/", label: "Library" },
          { label: `${run.sourceDocument.title} v${run.versionNumber}` },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{run.sourceDocument.title}</h1>
          <p className="text-sm text-stone-600">
            v{run.versionNumber} · {run.targetProfile.label} · method {run.methodSnapshot.methodVersion}{" "}
            <code className="text-xs">{run.methodSnapshot.methodSha256.slice(0, 12)}…</code>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={statusTone(run.status)}>{run.status}</Badge>
          <Link href={`/runs/${run.id}/review`} className="text-sm underline hover:no-underline">
            Review
          </Link>
          <Link href={`/runs/${run.id}/governance`} className="text-sm underline hover:no-underline">
            Governance record
          </Link>
        </div>
      </div>

      {!hasKey && (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          ANTHROPIC_API_KEY is not set, so no stage can run. Copy <code>.env.example</code> to{" "}
          <code>.env.local</code> and add your key. The seeded example is browsable without one.
        </p>
      )}

      {run.status === "BLOCKED" && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          <strong>Blocked.</strong> {run.blockedReason} There is no override: correct the text and re-run
          stage 5, or resolve each flag below with a written reason.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Pipeline" subtitle="Each stage is separately re-runnable. Every attempt is kept.">
          <ol className="space-y-2">
            {STAGES.map((stage) => {
              const row =
                latestByStage.get(stage.key) ??
                (stage.key === "VERIFY" ? latestByStage.get("VERIFY_MATCH") : undefined);
              const done = row?.status === "OK";
              return (
                <li key={stage.key} className="flex flex-wrap items-start gap-3 rounded border border-stone-200 p-3">
                  <span
                    className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                      done ? "bg-emerald-500" : row?.status === "FAILED" ? "bg-red-500" : "bg-stone-300"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{stage.label}</p>
                    <p className="text-xs text-stone-500">{stage.blurb}</p>
                    {row && (
                      <p className="mt-1 text-xs text-stone-500">
                        {row.model} · {row.promptTemplateId}@{row.promptTemplateVersion} · prompt{" "}
                        <code>{row.promptSha256.slice(0, 10)}</code>
                        {row.attempt > 1 && ` · attempt ${row.attempt}`}
                        {row.inputTokens != null && ` · ${row.inputTokens}/${row.outputTokens} tokens`}
                      </p>
                    )}
                    {row?.errorText && <p className="mt-1 text-xs text-red-700">{row.errorText}</p>}
                  </div>
                  <form action={rerunStage} className="no-print">
                    <input type="hidden" name="runId" value={run.id} />
                    <input type="hidden" name="stage" value={stage.key} />
                    <Button variant="secondary" disabled={!hasKey}>
                      {done ? "Re-run" : "Run"}
                    </Button>
                  </form>
                </li>
              );
            })}
          </ol>

          <div className="mt-4 flex flex-wrap gap-3">
            <form action={startPipeline}>
              <input type="hidden" name="runId" value={run.id} />
              <Button disabled={!hasKey}>Run stages 1–3</Button>
            </form>
            <form action={continuePipeline}>
              <input type="hidden" name="runId" value={run.id} />
              <Button variant="secondary" disabled={!hasKey || run.planItems.length === 0}>
                Approve plan and run 4–6
              </Button>
            </form>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Readability" subtitle="Computed in code, not estimated by a model.">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="py-1 text-left font-medium" />
                  <th className="py-1 text-right font-medium">Source</th>
                  <th className="py-1 text-right font-medium">Adapted</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-stone-100">
                  <td className="py-1 text-stone-500">Flesch-Kincaid</td>
                  <td className="py-1 text-right">{sourceReadability.fleschKincaidGrade}</td>
                  <td className="py-1 text-right">{adaptedReadability?.fleschKincaidGrade ?? "—"}</td>
                </tr>
                <tr className="border-t border-stone-100">
                  <td className="py-1 text-stone-500">SMOG</td>
                  <td className="py-1 text-right">{sourceReadability.smog}</td>
                  <td className="py-1 text-right">{adaptedReadability?.smog ?? "—"}</td>
                </tr>
                <tr className="border-t border-stone-100">
                  <td className="py-1 text-stone-500">Longest sentence</td>
                  <td className="py-1 text-right">{sourceReadability.maxWordsPerSentence}</td>
                  <td className="py-1 text-right">{adaptedReadability?.maxWordsPerSentence ?? "—"} words</td>
                </tr>
                <tr className="border-t border-stone-100">
                  <td className="py-1 text-stone-500">Over 20 words</td>
                  <td className="py-1 text-right">{sourceReadability.sentencesOver20}</td>
                  <td className="py-1 text-right">{adaptedReadability?.sentencesOver20 ?? "—"}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-3 text-xs text-stone-600">
              Target {run.targetProfile.readingLevelTarget}, ceiling {run.targetProfile.readingLevelCeiling}.
              RL-02 takes the higher of the two metrics, which here is SMOG
              {adaptedReadability && (
                <>
                  {" "}
                  at {adaptedReadability.smog}.{" "}
                  {adaptedReadability.smog > 7 ? (
                    <span className="text-amber-800">
                      Above the ceiling. SMOG counts three-syllable words, and this document cannot avoid
                      “cardiovascular”, “ambulance” or “medicine”. Whether SMOG is the right metric for
                      documents like this is RL-02, which is still an unconfirmed rule.
                    </span>
                  ) : (
                    <span className="text-emerald-800">Within the ceiling.</span>
                  )}
                </>
              )}
            </p>
          </Card>

          <Card title="Safety contract" subtitle={`${run.assertions.length} clinical assertions`}>
            <p className="text-sm text-stone-600">
              {run.assertions.filter((a) => a.isProtected).length} are protected by never-soften rules.
            </p>
            <p className="mt-2 text-sm">
              {run.checks.length === 0 ? (
                <span className="text-stone-500">Not yet verified.</span>
              ) : (
                <>
                  {run.checks.filter((c) => c.verdict === "PRESENT_UNCHANGED").length} unchanged ·{" "}
                  {run.checks.filter((c) => c.verdict !== "PRESENT_UNCHANGED").length} flagged
                </>
              )}
            </p>
          </Card>
        </div>
      </div>

      {openFlags.length > 0 && (
        <Card
          title={`Open fidelity flags (${openFlags.length})`}
          subtitle="The document cannot reach review until each is resolved. Resolving requires a written reason, which is recorded."
        >
          <ul className="space-y-4">
            {openFlags.map((check) => (
              <li key={check.id} className="rounded border border-red-200 bg-red-50/50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="bad">{check.verdict}</Badge>
                  {check.sourceAssertion && <code className="text-xs">{check.sourceAssertion.stableId}</code>}
                  {(JSON.parse(check.ruleIds) as string[]).map((r) => (
                    <code key={r} className="rounded bg-stone-900 px-1.5 py-0.5 text-xs text-white">
                      {r}
                    </code>
                  ))}
                  <span className="text-xs text-stone-500">via stage {check.stage}</span>
                </div>
                {check.sourceAssertion && (
                  <p className="mt-2 text-sm">
                    <span className="text-stone-500">Source claim: </span>
                    {check.sourceAssertion.text}
                  </p>
                )}
                <p className="mt-1 text-sm text-stone-800">{check.explanation}</p>
                {check.evidenceQuote && (
                  <p className="mt-1 text-sm text-stone-600">
                    <span className="text-stone-500">In the adaptation: </span>“{check.evidenceQuote}”
                  </p>
                )}
                <form action={resolveCheck} className="no-print mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="checkId" value={check.id} />
                  <label className="text-xs">
                    <span className="block font-medium text-stone-700">Resolution</span>
                    <select name="status" className="mt-1 rounded border border-stone-300 px-2 py-1 text-sm">
                      <option value="RESOLVED_BY_EDIT">Corrected by an edit</option>
                      <option value="RESOLVED_BY_RERUN">Corrected and stage re-run</option>
                      <option value="WITHDRAWN">Withdrawn as a false positive</option>
                    </select>
                  </label>
                  <label className="min-w-64 flex-1 text-xs">
                    <span className="block font-medium text-stone-700">Reason (required)</span>
                    <input name="resolutionNote" required className={`${inputClass} mt-1`} />
                  </label>
                  <Button variant="secondary">Resolve</Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {run.planItems.length > 0 && (
        <Card
          title={`Change plan (${run.planItems.filter((p) => p.status !== "REMOVED").length} items)`}
          subtitle="Inspect before rewriting. Removing an item means the rewrite will not make that change."
        >
          <ul className="space-y-3">
            {run.planItems.map((item) => (
              <li
                key={item.id}
                className={`rounded border p-3 ${
                  item.status === "REMOVED" ? "border-stone-200 bg-stone-50 opacity-60" : "border-stone-200"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-stone-500">{item.ordinal}</span>
                  <RuleTag ruleId={item.ruleId} status={item.ruleStatus} />
                  {item.touchesProtected && <Badge tone="warn">touches protected content</Badge>}
                  {item.status === "REMOVED" && <Badge>removed</Badge>}
                </div>
                <p className="mt-2 text-sm text-stone-600">“{item.targetQuote}”</p>
                <p className="mt-1 text-sm">{item.intent}</p>
                <p className="mt-1 text-xs text-stone-500">{item.rationale}</p>
                {item.status !== "REMOVED" && (
                  <form action={removePlanItem} className="no-print mt-2">
                    <input type="hidden" name="planItemId" value={item.id} />
                    <button className="text-xs text-red-700 underline hover:no-underline">Remove from plan</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {run.planItems.length === 0 && run.status === "CREATED" && (
        <Card>
          <Empty>Nothing has run yet. Start with stages 1–3 above.</Empty>
        </Card>
      )}
    </div>
  );
}
