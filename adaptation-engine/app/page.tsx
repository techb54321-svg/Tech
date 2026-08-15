import Link from "next/link";

import { prisma } from "../src/db";
import { Badge, Card, Empty, statusTone } from "./ui";

export const dynamic = "force-dynamic";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ condition?: string; status?: string; q?: string }>;
}) {
  const filters = await searchParams;

  const documents = await prisma.sourceDocument.findMany({
    where: {
      ...(filters.condition ? { condition: filters.condition } : {}),
      ...(filters.q ? { title: { contains: filters.q } } : {}),
    },
    include: {
      runs: {
        orderBy: { versionNumber: "desc" },
        include: {
          targetProfile: true,
          _count: { select: { changes: true } },
          checks: { where: { blocking: true, resolutionStatus: "OPEN" }, select: { id: true } },
        },
      },
    },
    orderBy: { ingestedAt: "desc" },
  });

  const conditions = [...new Set(documents.map((d) => d.condition))].sort();
  const visible = filters.status
    ? documents.filter((d) => d.runs.some((r) => r.status === filters.status))
    : documents;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Library</h1>
          <p className="text-sm text-stone-600">
            {documents.length} source document{documents.length === 1 ? "" : "s"},{" "}
            {documents.reduce((n, d) => n + d.runs.length, 0)} adaptation
            {documents.reduce((n, d) => n + d.runs.length, 0) === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/intake" className="rounded bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700">
          New document
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-stone-200 bg-white p-4">
        <label className="text-xs">
          <span className="block font-medium text-stone-700">Search title</span>
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            className="mt-1 rounded border border-stone-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs">
          <span className="block font-medium text-stone-700">Condition</span>
          <select name="condition" defaultValue={filters.condition ?? ""} className="mt-1 rounded border border-stone-300 px-2 py-1 text-sm">
            <option value="">All</option>
            {conditions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="block font-medium text-stone-700">Status</span>
          <select name="status" defaultValue={filters.status ?? ""} className="mt-1 rounded border border-stone-300 px-2 py-1 text-sm">
            <option value="">Any</option>
            {["CREATED", "PLAN_REVIEW", "BLOCKED", "IN_REVIEW", "REVIEW_COMPLETE"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded bg-white px-3 py-1.5 text-sm font-medium ring-1 ring-inset ring-stone-300 hover:bg-stone-50">
          Filter
        </button>
        <Link href="/" className="px-1 text-xs text-stone-500 hover:text-stone-900">
          Clear
        </Link>
      </form>

      {visible.length === 0 && (
        <Card>
          <Empty>
            Nothing here yet. <Link href="/intake" className="underline">Add a document</Link>, or run{" "}
            <code className="rounded bg-stone-100 px-1">npm run seed</code> for the worked example.
          </Empty>
        </Card>
      )}

      <div className="space-y-4">
        {visible.map((doc) => (
          <Card key={doc.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="font-semibold tracking-tight">{doc.title}</h2>
                <p className="text-xs text-stone-500">
                  {doc.sourceOrganisation} · {doc.condition} · {doc.intendedAudience} · source sha256{" "}
                  <code>{doc.sourceSha256.slice(0, 12)}…</code>
                </p>
              </div>
              <p className="text-xs text-stone-500">{doc.ingestedAt.toISOString().slice(0, 10)}</p>
            </div>

            {doc.notes?.startsWith("SYNTHETIC") && (
              <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900 ring-1 ring-inset ring-amber-200">
                Synthetic demonstration document — not a real health service publication.
              </p>
            )}

            <table className="mt-4 w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="py-1 pr-4 font-medium">Version</th>
                  <th className="py-1 pr-4 font-medium">Profile</th>
                  <th className="py-1 pr-4 font-medium">Status</th>
                  <th className="py-1 pr-4 font-medium">Changes</th>
                  <th className="py-1 pr-4 font-medium">Open flags</th>
                  <th className="py-1 font-medium" />
                </tr>
              </thead>
              <tbody>
                {doc.runs.map((run) => (
                  <tr key={run.id} className="border-t border-stone-100">
                    <td className="py-2 pr-4">
                      v{run.versionNumber}
                      {run.parentRunId && <span className="ml-1 text-xs text-stone-400">re-run</span>}
                    </td>
                    <td className="py-2 pr-4 text-stone-600">{run.targetProfile.label}</td>
                    <td className="py-2 pr-4">
                      <Badge tone={statusTone(run.status)}>{run.status}</Badge>
                    </td>
                    <td className="py-2 pr-4 text-stone-600">{run._count.changes}</td>
                    <td className="py-2 pr-4">
                      {run.checks.length > 0 ? (
                        <Badge tone="bad">{run.checks.length}</Badge>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <Link href={`/runs/${run.id}`} className="text-sm underline hover:no-underline">
                        Pipeline
                      </Link>
                      <Link href={`/runs/${run.id}/review`} className="ml-3 text-sm underline hover:no-underline">
                        Review
                      </Link>
                      <Link href={`/runs/${run.id}/governance`} className="ml-3 text-sm underline hover:no-underline">
                        Record
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}
      </div>
    </div>
  );
}
