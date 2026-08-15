import Link from "next/link";

import { prisma } from "../../../../src/db";
import { buildGovernancePayload } from "../../../../src/governance";
import { generateRecord } from "../../../actions";
import { Badge, Button, Crumbs, Prose, verdictTone } from "../../../ui";

export const dynamic = "force-dynamic";

/**
 * The printable record. Laid out to be read on paper by people who were not in
 * the room: what the source was, what method was applied, what the machine did,
 * whether any clinical meaning moved, and who signed.
 */
export default async function GovernancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payload = await buildGovernancePayload(id);
  const stored = await prisma.governanceRecord.findMany({
    where: { runId: id },
    orderBy: { renderedAt: "desc" },
    take: 5,
  });

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="print-break mt-8">
      <h2 className="border-b border-stone-300 pb-1 text-sm font-semibold uppercase tracking-wide">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex gap-3 py-1 text-sm">
      <dt className="w-56 shrink-0 text-stone-500">{label}</dt>
      <dd className="min-w-0 flex-1">{value}</dd>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl">
      <Crumbs
        items={[
          { href: "/", label: "Library" },
          { href: `/runs/${id}`, label: `v${payload.adaptation.versionNumber}` },
          { label: "Governance record" },
        ]}
      />

      <div className="no-print mb-6 flex flex-wrap items-center gap-3">
        <form action={generateRecord}>
          <input type="hidden" name="runId" value={id} />
          <Button>Store an immutable copy</Button>
        </form>
        <p className="text-xs text-stone-500">
          {stored.length > 0
            ? `${stored.length} stored copy${stored.length === 1 ? "" : "ies"}; latest ${stored[0].renderedAt
                .toISOString()
                .slice(0, 16)
                .replace("T", " ")} · sha256 ${stored[0].payloadSha256.slice(0, 12)}…`
            : "No stored copy yet. Storing freezes this record so it can be reproduced byte for byte later."}
        </p>
        <Link href={`/runs/${id}/review`} className="ml-auto text-sm underline hover:no-underline">
          Back to review
        </Link>
      </div>

      <article className="rounded-lg border border-stone-200 bg-white p-8 print:border-0 print:p-0">
        <header>
          <p className="text-xs uppercase tracking-widest text-stone-500">Adaptation governance record</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{payload.document.title}</h1>
          <p className="mt-1 text-sm text-stone-600">
            {payload.document.sourceOrganisation} · {payload.document.condition} · version{" "}
            {payload.adaptation.versionNumber}
          </p>
          {payload.blocked && (
            <p className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
              <strong>This document is blocked.</strong> {payload.blockedReason} It must not be published or
              distributed in this state.
            </p>
          )}
          {payload.document.notes?.startsWith("SYNTHETIC") && (
            <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Synthetic demonstration document. Not a real health service publication.
            </p>
          )}
        </header>

        <Section title="1. Provenance">
          <dl>
            <Row label="Source document" value={payload.document.title} />
            <Row label="Publisher" value={payload.document.sourceOrganisation} />
            <Row label="Intended audience" value={payload.document.intendedAudience} />
            <Row label="Source SHA-256" value={<code className="break-all text-xs">{payload.document.sourceSha256}</code>} />
            <Row label="Ingested" value={payload.document.ingestedAt} />
            <Row
              label="Adapted SHA-256"
              value={<code className="break-all text-xs">{payload.adaptation.adaptedSha256 ?? "not yet produced"}</code>}
            />
            <Row label="Run ID" value={<code className="text-xs">{payload.adaptation.runId}</code>} />
            <Row label="Created" value={payload.adaptation.createdAt} />
            {payload.adaptation.parentRunId && (
              <Row label="Re-run of" value={<code className="text-xs">{payload.adaptation.parentRunId}</code>} />
            )}
          </dl>
        </Section>

        <Section title="2. Method applied">
          <dl>
            <Row label="Method version" value={`${payload.method.version}`} />
            <Row label="Method SHA-256" value={<code className="break-all text-xs">{payload.method.sha256}</code>} />
            <Row label="Rules in force" value={`${payload.method.ruleCount}`} />
            <Row
              label="Rule provenance"
              value={`${payload.method.ruleStatusCounts.confirmed} confirmed, ${payload.method.ruleStatusCounts.assumed} assumed, ${payload.method.ruleStatusCounts.strawman} unconfirmed`}
            />
            <Row
              label="Changes from unconfirmed rules"
              value={
                payload.method.changesFromUnconfirmedRules > 0 ? (
                  <>
                    {payload.method.changesFromUnconfirmedRules} of {payload.changeSummary.total}{" "}
                    <span className="text-stone-500">
                      — produced by rules the method author has not yet confirmed
                    </span>
                  </>
                ) : (
                  "none"
                )
              }
            />
            <Row label="Target profile" value={payload.targetProfile.label} />
            <Row label="Language" value={`${payload.targetProfile.language}${payload.targetProfile.translated ? " (translated)" : " (not translated)"}`} />
            <Row label="Reading level target" value={`${payload.targetProfile.readingLevelTarget} (ceiling ${payload.targetProfile.readingLevelCeiling})`} />
            <Row label="Addressee mode" value={payload.targetProfile.addresseeMode} />
            <Row label="Community" value={payload.targetProfile.community ?? "not set"} />
            <Row label="Messenger" value={payload.targetProfile.messenger ?? "not set"} />
          </dl>

          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="py-1 pr-4 font-medium">Rule</th>
                <th className="py-1 pr-4 font-medium">Dimension</th>
                <th className="py-1 pr-4 font-medium">Provenance</th>
                <th className="py-1 font-medium">Changes</th>
              </tr>
            </thead>
            <tbody>
              {payload.method.rulesApplied.map((r) => (
                <tr key={r.ruleId} className="border-t border-stone-100">
                  <td className="py-1 pr-4">
                    <code>{r.ruleId}</code>
                  </td>
                  <td className="py-1 pr-4 text-stone-600">{r.dimension}</td>
                  <td className="py-1 pr-4">{r.ruleStatus}</td>
                  <td className="py-1">{r.changes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="3. Models and prompts">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="py-1 pr-4 font-medium">Stage</th>
                <th className="py-1 pr-4 font-medium">Model</th>
                <th className="py-1 pr-4 font-medium">Prompt</th>
                <th className="py-1 pr-4 font-medium">Prompt SHA-256</th>
                <th className="py-1 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {payload.models.map((m, i) => (
                <tr key={`${m.stage}-${m.attempt}-${i}`} className="border-t border-stone-100">
                  <td className="py-1 pr-4">
                    {m.stage}
                    {m.attempt > 1 && <span className="text-stone-400"> #{m.attempt}</span>}
                  </td>
                  <td className="py-1 pr-4">{m.model}</td>
                  <td className="py-1 pr-4 text-stone-600">{m.promptTemplate}</td>
                  <td className="py-1 pr-4">
                    <code className="text-xs">{m.promptSha256.slice(0, 12)}…</code>
                  </td>
                  <td className="py-1">{m.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="4. Readability">
          <dl>
            <Row label="Method" value={payload.readability.method} />
            <Row
              label="Source"
              value={`grade ${payload.readability.source.gradeLevel} (FK ${payload.readability.source.fleschKincaidGrade}, SMOG ${payload.readability.source.smog}), longest sentence ${payload.readability.source.maxWordsPerSentence} words`}
            />
            <Row
              label="Adaptation"
              value={
                payload.readability.adapted
                  ? `grade ${payload.readability.adapted.gradeLevel} (FK ${payload.readability.adapted.fleschKincaidGrade}, SMOG ${payload.readability.adapted.smog}), longest sentence ${payload.readability.adapted.maxWordsPerSentence} words`
                  : "not yet produced"
              }
            />
            <Row label="Target" value={`${payload.readability.target}, ceiling ${payload.readability.ceiling}`} />
          </dl>
        </Section>

        <Section title="5. Clinical fidelity">
          <p className="text-sm">
            {payload.fidelity.assertionsInSource} clinical assertions extracted from the source,{" "}
            {payload.fidelity.protectedAssertions} protected by never-soften rules.{" "}
            {payload.fidelity.unchanged} verified present and unchanged, {payload.fidelity.flagged} flagged,{" "}
            {payload.fidelity.openBlocking} still open.
          </p>

          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="py-1 pr-3 font-medium">ID</th>
                <th className="py-1 pr-3 font-medium">Clinical assertion</th>
                <th className="py-1 pr-3 font-medium">Strength</th>
                <th className="py-1 pr-3 font-medium">Protected</th>
                <th className="py-1 font-medium">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {payload.fidelity.assertions.map((a) => (
                <tr key={a.id} className="border-t border-stone-100 align-top">
                  <td className="py-1.5 pr-3">
                    <code className="text-xs">{a.id}</code>
                  </td>
                  <td className="py-1.5 pr-3">
                    {a.claim}
                    {a.verdicts
                      .filter((v) => v.verdict !== "PRESENT_UNCHANGED")
                      .map((v, i) => (
                        <p key={i} className="mt-1 text-xs text-red-800">
                          {v.explanation}
                          {v.resolution !== "OPEN" && (
                            <span className="text-stone-600">
                              {" "}
                              — {v.resolution.toLowerCase().replaceAll("_", " ")}
                              {v.resolvedBy ? ` by ${v.resolvedBy}` : ""}
                              {v.resolutionNote ? `: ${v.resolutionNote}` : ""}
                            </span>
                          )}
                        </p>
                      ))}
                  </td>
                  <td className="py-1.5 pr-3 text-stone-600">{a.strength}</td>
                  <td className="py-1.5 pr-3 text-xs text-stone-600">
                    {a.protected ? a.protectedBy.join(", ") : "—"}
                  </td>
                  <td className="py-1.5">
                    {a.verdicts.length === 0 ? (
                      <span className="text-stone-400">not checked</span>
                    ) : (
                      a.verdicts.map((v, i) => (
                        <Badge key={i} tone={verdictTone(v.verdict)}>
                          {v.verdict}
                        </Badge>
                      ))
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {payload.fidelity.invented.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold">Claims found in the adaptation that the source did not make</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {payload.fidelity.invented.map((v, i) => (
                  <li key={i} className="rounded border border-red-200 bg-red-50 p-2">
                    <p>{v.explanation}</p>
                    {v.evidence && <p className="mt-1 text-stone-700">“{v.evidence}”</p>}
                    <p className="mt-1 text-xs text-stone-600">
                      {v.resolution.toLowerCase().replaceAll("_", " ")}
                      {v.resolutionNote ? `: ${v.resolutionNote}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        <Section title="6. Changes and reviewer decisions">
          <p className="text-sm">
            {payload.changeSummary.total} changes — {payload.changeSummary.accepted} accepted,{" "}
            {payload.changeSummary.edited} edited, {payload.changeSummary.rejected} rejected,{" "}
            {payload.changeSummary.pending} pending.
            {Object.keys(payload.changeSummary.flags).length > 0 && (
              <>
                {" "}
                Flags raised:{" "}
                {Object.entries(payload.changeSummary.flags)
                  .map(([k, v]) => `${k.replaceAll("_", " ").toLowerCase()} ×${v}`)
                  .join(", ")}
                .
              </>
            )}
          </p>

          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="py-1 pr-3 font-medium">#</th>
                <th className="py-1 pr-3 font-medium">Rule</th>
                <th className="py-1 pr-3 font-medium">Change</th>
                <th className="py-1 font-medium">Decision</th>
              </tr>
            </thead>
            <tbody>
              {payload.changes.map((c) => (
                <tr key={c.ordinal} className="border-t border-stone-100 align-top">
                  <td className="py-2 pr-3 text-stone-500">{c.ordinal}</td>
                  <td className="py-2 pr-3">
                    <code className="text-xs">{c.rule}</code>
                    {c.ruleStatus !== "confirmed" && (
                      <span className="block text-xs text-amber-800">{c.ruleStatus}</span>
                    )}
                    {c.flagType && <span className="block text-xs text-stone-500">{c.flagType}</span>}
                  </td>
                  <td className="py-2 pr-3">
                    <p className="text-stone-500 line-through decoration-stone-300">{c.before}</p>
                    <p className="mt-0.5">{c.after}</p>
                    <p className="mt-1 text-xs text-stone-500">{c.rationale}</p>
                  </td>
                  <td className="py-2">
                    {c.decision.toLowerCase()}
                    {c.decidedBy && <span className="block text-xs text-stone-500">{c.decidedBy}</span>}
                    {c.reasonCode && <span className="block text-xs text-stone-500">{c.reasonCode}</span>}
                    {c.reasonText && <span className="block text-xs text-stone-500">{c.reasonText}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="7. Sign-off">
          {payload.signoffs.length === 0 ? (
            <p className="text-sm text-stone-500">Not yet signed off.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {payload.signoffs.map((s, i) => (
                <li key={i}>
                  <strong>{s.reviewer}</strong> — {s.role}, {s.scope} — {s.verdict} — {s.signedAt}
                  {s.note && <span className="text-stone-600"> — {s.note}</span>}
                </li>
              ))}
            </ul>
          )}
          {payload.sourceIssues.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold">Issues raised about the source document</h3>
              <ul className="mt-1 space-y-1 text-sm">
                {payload.sourceIssues.map((i, idx) => (
                  <li key={idx}>
                    {i.description} <span className="text-stone-500">({i.status})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        <Section title="8. Texts">
          <h3 className="text-sm font-semibold">Source</h3>
          <div className="mt-1 rounded bg-stone-50 p-3">
            <Prose text={payload.sourceText} />
          </div>
          <h3 className="mt-4 text-sm font-semibold">Adaptation</h3>
          <div className="mt-1 rounded bg-stone-50 p-3">
            <Prose text={payload.adaptedText || "not yet produced"} />
          </div>
        </Section>
      </article>
    </div>
  );
}
