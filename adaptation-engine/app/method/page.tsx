import { prisma } from "../../src/db";
import { loadMethod } from "../../src/method/loader";
import { updateRefinement } from "../actions";
import { Badge, Button, Card, Crumbs, Empty, inputClass } from "../ui";

export const dynamic = "force-dynamic";

/**
 * The method as the app sees it, plus the refinement queue that reviewer
 * rejections feed. Read-only: the rules are edited in the files, which is the
 * point of them being files.
 */
export default async function MethodPage() {
  const method = loadMethod();
  const candidates = await prisma.methodRefinementCandidate.findMany({
    include: { change: true },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const open = candidates.filter((c) => c.status === "NEW" || c.status === "TRIAGED");

  return (
    <div className="space-y-6">
      <Crumbs items={[{ href: "/", label: "Library" }, { label: "Method" }]} />

      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Method {method.manifest.method_version}{" "}
          <Badge tone={method.manifest.status === "active" ? "good" : "warn"}>{method.manifest.status}</Badge>
        </h1>
        <p className="text-sm text-stone-600">
          {method.ruleCount} rules · {method.statusCounts.confirmed} confirmed, {method.statusCounts.assumed} assumed,{" "}
          {method.statusCounts.strawman} unconfirmed · content hash{" "}
          <code className="text-xs">{method.methodSha256.slice(0, 16)}…</code>
        </p>
        <p className="mt-1 text-sm text-stone-600">
          Edit the rules in <code>method/</code> and run <code>npm run method:check</code>. They are not editable
          here on purpose: the files are the product, and every run stores its own copy of them.
        </p>
      </div>

      <Card
        title={`Refinement queue (${open.length} open)`}
        subtitle="Rejected changes, grouped by the rule they blame. This is how the method improves between documents."
      >
        {candidates.length === 0 && <Empty>Nothing queued. Rejections with a reason code land here.</Empty>}
        <ul className="space-y-3">
          {candidates.map((c) => (
            <li key={c.id} className="rounded border border-stone-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-stone-900 px-1.5 py-0.5 text-xs text-white">{c.ruleId}</code>
                <Badge tone={c.reasonCode === "CLINICAL_DRIFT" ? "bad" : "warn"}>{c.reasonCode}</Badge>
                <Badge tone={c.status === "ACCEPTED" ? "good" : "neutral"}>{c.status}</Badge>
                <span className="text-xs text-stone-500">{c.createdAt.toISOString().slice(0, 10)}</span>
              </div>
              <p className="mt-2 text-sm">{c.reasonText}</p>
              {c.change && (
                <p className="mt-1 text-xs text-stone-500">
                  From change #{c.change.ordinal}: “{c.change.beforeText.slice(0, 80)}
                  {c.change.beforeText.length > 80 ? "…" : ""}” → “{c.change.afterText.slice(0, 80)}
                  {c.change.afterText.length > 80 ? "…" : ""}”
                </p>
              )}
              {c.proposedRuleChange && (
                <p className="mt-2 rounded bg-stone-50 p-2 text-sm">
                  <span className="text-stone-500">Proposed: </span>
                  {c.proposedRuleChange}
                </p>
              )}
              <form action={updateRefinement} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="candidateId" value={c.id} />
                <label className="text-xs">
                  <span className="block font-medium text-stone-700">Status</span>
                  <select name="status" defaultValue={c.status} className="mt-1 rounded border border-stone-300 px-2 py-1 text-sm">
                    {["NEW", "TRIAGED", "ACCEPTED", "DISMISSED"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-64 flex-1 text-xs">
                  <span className="block font-medium text-stone-700">Proposed rule change</span>
                  <input
                    name="proposedRuleChange"
                    defaultValue={c.proposedRuleChange ?? ""}
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <label className="text-xs">
                  <span className="block font-medium text-stone-700">Resolved in version</span>
                  <input name="resolvedInMethodVersion" defaultValue={c.resolvedInMethodVersion ?? ""} className="mt-1 w-24 rounded border border-stone-300 px-2 py-1 text-sm" />
                </label>
                <Button variant="secondary">Save</Button>
              </form>
            </li>
          ))}
        </ul>
      </Card>

      {method.dimensions.map((dim) => (
        <Card key={dim.id} title={dim.label} subtitle={`${dim.rules.length} rules · ${dim.file}`}>
          <ul className="space-y-3">
            {dim.rules.map((rule) => (
              <li key={rule.id} className="border-b border-stone-100 pb-3 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded bg-stone-900 px-1.5 py-0.5 text-xs text-white">{rule.id}</code>
                  <span className="text-sm font-medium">{rule.title}</span>
                  {rule.status !== "confirmed" && (
                    <Badge tone="warn">{rule.status === "strawman" ? "unconfirmed" : "assumed"}</Badge>
                  )}
                  {rule.blocking && <Badge tone="bad">blocking</Badge>}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700">{rule.statement.trim()}</p>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
