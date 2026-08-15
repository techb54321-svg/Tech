import Link from "next/link";

import { prisma } from "../../../../src/db";
import { loadMethodFromSnapshot } from "../../../../src/method/loader";
import { applyDecisions, composeFinalText, decideChange, signOff } from "../../../actions";
import { Badge, Button, Card, Crumbs, Empty, Prose, RuleTag, inputClass, statusTone } from "../../../ui";

export const dynamic = "force-dynamic";

interface TaxonomyCode {
  code: string;
  label: string;
  description: string;
}

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const run = await prisma.adaptationRun.findUniqueOrThrow({
    where: { id },
    include: {
      sourceDocument: true,
      targetProfile: true,
      methodSnapshot: true,
      changes: { include: { decidedBy: true }, orderBy: { ordinal: "asc" } },
      checks: { where: { blocking: true, resolutionStatus: "OPEN" }, select: { id: true } },
      signoffs: { include: { reviewer: true } },
    },
  });

  const method = loadMethodFromSnapshot(run.methodSnapshot.filesJson);
  const taxonomy = ((method.data["rejection-taxonomy"] as { codes?: TaxonomyCode[] })?.codes ?? []) as TaxonomyCode[];
  const reviewers = await prisma.reviewer.findMany({ orderBy: { name: "asc" } });
  const { text: composed, unapplied } = await composeFinalText(run.id);

  const counts = {
    total: run.changes.length,
    pending: run.changes.filter((c) => c.decision === "PENDING").length,
    accepted: run.changes.filter((c) => c.decision === "ACCEPTED").length,
    edited: run.changes.filter((c) => c.decision === "EDITED").length,
    rejected: run.changes.filter((c) => c.decision === "REJECTED").length,
    flags: run.changes.filter((c) => c.flagType).length,
    unconfirmed: run.changes.filter((c) => c.ruleStatus !== "confirmed").length,
  };

  const blocked = run.checks.length > 0;

  return (
    <div className="space-y-6">
      <Crumbs
        items={[
          { href: "/", label: "Library" },
          { href: `/runs/${run.id}`, label: `v${run.versionNumber}` },
          { label: "Review" },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Review — {run.sourceDocument.title}</h1>
          <p className="text-sm text-stone-600">
            {counts.total} changes · {counts.pending} pending · {counts.accepted} accepted · {counts.edited} edited ·{" "}
            {counts.rejected} rejected · {counts.flags} flags
            {counts.unconfirmed > 0 && ` · ${counts.unconfirmed} from unconfirmed rules`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={statusTone(run.status)}>{run.status}</Badge>
          <Link href={`/runs/${run.id}/governance`} className="text-sm underline hover:no-underline">
            Governance record
          </Link>
        </div>
      </div>

      {blocked && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          <strong>{run.checks.length} fidelity flag(s) open.</strong> You can review changes, but this document
          cannot be signed off until every flag is resolved — see the{" "}
          <Link href={`/runs/${run.id}`} className="underline">
            pipeline screen
          </Link>
          .
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Source" subtitle={`${run.sourceDocument.sourceOrganisation} · sha256 ${run.sourceDocument.sourceSha256.slice(0, 12)}…`}>
          <div className="max-h-[28rem] overflow-y-auto rounded bg-stone-50 p-3">
            <Prose text={run.sourceDocument.sourceText} />
          </div>
        </Card>
        <Card
          title="Adaptation"
          subtitle={
            run.finalText
              ? "Final text, with your decisions applied."
              : "Model output. Your decisions are applied when you press Apply decisions."
          }
        >
          <div className="max-h-[28rem] overflow-y-auto rounded bg-stone-50 p-3">
            <Prose text={run.finalText ?? run.adaptedText ?? "Nothing yet — run stage 4."} />
          </div>
        </Card>
      </div>

      {run.adaptedText && (
        <Card title="Apply decisions" subtitle="Edits replace the model's wording; rejections revert to the source wording.">
          <div className="flex flex-wrap items-center gap-3">
            <form action={applyDecisions}>
              <input type="hidden" name="runId" value={run.id} />
              <Button variant="secondary">Apply decisions to the text</Button>
            </form>
            <p className="text-xs text-stone-500">
              {composed === (run.finalText ?? run.adaptedText)
                ? "Nothing outstanding to apply."
                : "Decisions are waiting to be applied."}
              {unapplied.length > 0 && (
                <span className="ml-1 text-amber-800">
                  Changes {unapplied.join(", ")} could not be located in the text and need a manual edit.
                </span>
              )}
            </p>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        <h2 className="text-sm font-semibold tracking-tight">Changes</h2>
        {run.changes.length === 0 && (
          <Card>
            <Empty>No changes yet — run stage 4.</Empty>
          </Card>
        )}

        {run.changes.map((change) => (
          <Card key={change.id} className={change.decision === "REJECTED" ? "opacity-70" : ""}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-stone-500">#{change.ordinal}</span>
              <RuleTag ruleId={change.ruleId} status={change.ruleStatus} />
              {change.flagType && <Badge tone="warn">{change.flagType.replaceAll("_", " ").toLowerCase()}</Badge>}
              {change.citesDataEntryId && <Badge tone="info">cites {change.citesDataEntryId}</Badge>}
              {(JSON.parse(change.touchesAssertionIds) as string[]).map((a) => (
                <code key={a} className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-700">
                  {a}
                </code>
              ))}
              <span className="ml-auto">
                <Badge
                  tone={
                    change.decision === "ACCEPTED"
                      ? "good"
                      : change.decision === "REJECTED"
                        ? "bad"
                        : change.decision === "EDITED"
                          ? "info"
                          : "neutral"
                  }
                >
                  {change.decision.toLowerCase()}
                </Badge>
              </span>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded border border-stone-200 bg-stone-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Before</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{change.beforeText}</p>
              </div>
              <div className="rounded border border-stone-200 bg-white p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-stone-500">After</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{change.afterText}</p>
                {change.editedText && (
                  <>
                    <p className="mt-3 text-xs font-medium uppercase tracking-wide text-sky-700">Your edit</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{change.editedText}</p>
                  </>
                )}
              </div>
            </div>

            <p className="mt-3 text-sm text-stone-700">
              <span className="text-stone-500">Why: </span>
              {change.rationalePlain}
            </p>

            {change.decision !== "PENDING" && (
              <p className="mt-2 text-xs text-stone-500">
                {change.decision.toLowerCase()} by {change.decidedBy?.name ?? "unknown"}{" "}
                {change.decidedAt?.toISOString().slice(0, 16).replace("T", " ")}
                {change.decisionReasonCode && ` · ${change.decisionReasonCode}`}
                {change.decisionReasonText && ` — ${change.decisionReasonText}`}
              </p>
            )}

            <form action={decideChange} className="no-print mt-4 space-y-2 border-t border-stone-100 pt-3">
              <input type="hidden" name="changeId" value={change.id} />
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs">
                  <span className="block font-medium text-stone-700">Decision</span>
                  <select name="decision" defaultValue="ACCEPTED" className="mt-1 rounded border border-stone-300 px-2 py-1 text-sm">
                    <option value="ACCEPTED">Accept</option>
                    <option value="EDITED">Edit</option>
                    <option value="REJECTED">Reject</option>
                  </select>
                </label>
                <label className="text-xs">
                  <span className="block font-medium text-stone-700">Reviewer</span>
                  <select name="reviewerId" className="mt-1 rounded border border-stone-300 px-2 py-1 text-sm">
                    {reviewers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  <span className="block font-medium text-stone-700">If rejecting, why</span>
                  <select name="reasonCode" className="mt-1 rounded border border-stone-300 px-2 py-1 text-sm">
                    <option value="">—</option>
                    {taxonomy.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <Button variant="secondary">Save</Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input name="reasonText" placeholder="Reason / note" className={inputClass} />
                <input name="editedText" placeholder="Replacement text, if editing" className={inputClass} />
              </div>
            </form>
          </Card>
        ))}
      </div>

      <Card
        title="Sign-off"
        subtitle="Recorded on the governance record. Blocked documents cannot be signed off, and there is no override."
      >
        {run.signoffs.length > 0 && (
          <ul className="mb-4 space-y-1 text-sm">
            {run.signoffs.map((s) => (
              <li key={s.id}>
                <strong>{s.reviewer.name}</strong> ({s.role}, {s.scope}) — {s.verdict}{" "}
                <span className="text-stone-500">{s.signedAt.toISOString().slice(0, 16).replace("T", " ")}</span>
                {s.note && <span className="text-stone-600"> — {s.note}</span>}
              </li>
            ))}
          </ul>
        )}
        <form action={signOff} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="runId" value={run.id} />
          <label className="text-xs">
            <span className="block font-medium text-stone-700">Reviewer</span>
            <select name="reviewerId" className="mt-1 rounded border border-stone-300 px-2 py-1 text-sm">
              {reviewers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="block font-medium text-stone-700">Role</span>
            <select name="role" className="mt-1 rounded border border-stone-300 px-2 py-1 text-sm">
              <option value="AUTHOR">Author</option>
              <option value="COMMUNITY_REVIEWER">Community reviewer</option>
              <option value="CLINICIAN">Clinician</option>
            </select>
          </label>
          <label className="text-xs">
            <span className="block font-medium text-stone-700">Scope</span>
            <select name="scope" className="mt-1 rounded border border-stone-300 px-2 py-1 text-sm">
              <option value="FULL_REVIEW">Full review</option>
              <option value="FINAL_SPOT_CHECK">Final spot-check</option>
            </select>
          </label>
          <label className="text-xs">
            <span className="block font-medium text-stone-700">Verdict</span>
            <select name="verdict" className="mt-1 rounded border border-stone-300 px-2 py-1 text-sm">
              <option value="APPROVED">Approved</option>
              <option value="APPROVED_WITH_EDITS">Approved with edits</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </label>
          <label className="min-w-64 flex-1 text-xs">
            <span className="block font-medium text-stone-700">Note</span>
            <input name="note" className={`${inputClass} mt-1`} />
          </label>
          <Button disabled={blocked}>Sign off</Button>
        </form>
      </Card>
    </div>
  );
}
