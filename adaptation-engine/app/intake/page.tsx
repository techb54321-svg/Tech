import { prisma } from "../../src/db";
import { loadMethod } from "../../src/method/loader";
import { syncProfiles } from "../../src/pipeline/run";
import { createDocumentAndRun } from "../actions";
import { Button, Card, Crumbs, Field, inputClass } from "../ui";

export const dynamic = "force-dynamic";

export default async function IntakePage() {
  const method = loadMethod();
  await syncProfiles(method);
  const profiles = await prisma.targetProfile.findMany({ orderBy: { key: "asc" } });

  return (
    <div className="max-w-3xl space-y-6">
      <Crumbs items={[{ href: "/", label: "Library" }, { label: "Intake" }]} />

      <div>
        <h1 className="text-xl font-semibold tracking-tight">New source document</h1>
        <p className="text-sm text-stone-600">
          Paste the source exactly as published. It is stored unedited and hashed; a corrected source
          becomes a new document rather than an edit to this one.
        </p>
      </div>

      <form action={createDocumentAndRun} className="space-y-5">
        <Card title="The document">
          <div className="space-y-4">
            <Field label="Title">
              <input name="title" required className={inputClass} placeholder="Understanding Your Heart Risk" />
            </Field>
            <Field label="Source text" hint="Markdown or plain text. Headings help the per-section reading level check.">
              <textarea name="sourceText" required rows={16} className={`${inputClass} font-mono text-xs`} />
            </Field>
          </div>
        </Card>

        <Card title="Tags" subtitle="These appear on the governance record.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Condition">
              <input name="condition" required className={inputClass} placeholder="Cardiovascular disease" />
            </Field>
            <Field label="Source organisation">
              <input name="sourceOrganisation" required className={inputClass} placeholder="Northern Metropolitan Health Service" />
            </Field>
            <Field label="Intended audience">
              <input name="intendedAudience" required className={inputClass} placeholder="Adults at raised cardiovascular risk" />
            </Field>
            <Field label="Source URL" hint="Optional.">
              <input name="sourceUrl" className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes" hint="Optional. Anything the reviewer or committee should know about provenance.">
                <input name="notes" className={inputClass} />
              </Field>
            </div>
          </div>
        </Card>

        <Card
          title="Target profile"
          subtitle="Profiles are defined in method/method.yaml. Editing one there and re-seeding affects new runs only."
        >
          <div className="space-y-3">
            {profiles.map((p) => (
              <label key={p.key} className="flex gap-3 rounded border border-stone-200 p-3 text-sm">
                <input type="radio" name="profileKey" value={p.key} defaultChecked={p.key === "cald-en-g5"} className="mt-1" />
                <span>
                  <span className="font-medium">{p.label}</span>
                  <span className="mt-1 block text-xs text-stone-500">
                    {p.language}
                    {p.translate ? " · translated" : " · not translated"} · {p.readingLevelTarget} (ceiling{" "}
                    {p.readingLevelCeiling}) · addressee {p.addresseeMode} · community {p.community ?? "not set"} ·
                    messenger {p.messenger ?? "not set"}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit">Create and open pipeline</Button>
          <p className="text-xs text-stone-500">
            Nothing is sent to a model yet — you start the stages on the next screen.
          </p>
        </div>
      </form>
    </div>
  );
}
