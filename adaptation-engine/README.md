# Clinical content adaptation engine

Adapts clinical health content for culturally and linguistically diverse and
low-health-literacy audiences, and produces a governance record proving no
clinical meaning drifted.

Not translation. Translation carries a document's failures into another
language; adaptation rewrites reading level, numeracy format, addressee,
cultural framing and examples while holding every clinical claim exactly.

Two things make it defensible: an explicit, versioned specification of what
makes an adaptation correct (`method/`), and a per-document audit trail
(`prisma/schema.prisma`) that a clinical governance committee can accept.

## Status

Method files, data model, pipeline and web app are all built. The pipeline has
been typechecked and its persistence exercised, but **it has not yet been run
against a live model** — the machine it was built on had no API key. The seeded
worked example is hand-authored and labelled as such everywhere it appears.

48 method rules: 13 confirmed by the method author, 9 assumed, 26 still the
engine author's strawmen. Run `npm run method:check` for the live list.

## Layout

```
method/            THE PRODUCT — versioned adaptation rules, editable by hand
  METHOD.md        how to read and edit them
prisma/
  schema.prisma    the data model, and the audit trail's shape
src/
  method/          loads, validates, hashes and renders the method files
  pipeline/        the six stages, their prompts and their output contracts
  readability.ts   Flesch-Kincaid and SMOG, computed not estimated
  governance.ts    builds and stores the governance record
  llm.ts           the only path to the API; every call writes a StageRun row
app/               the web app (Next.js App Router)
scripts/           check-method, adapt (CLI), seed
seed/              synthetic source document and the hand-authored example
DECISIONS.md       every architectural choice and why
```

## Getting started

```sh
npm install
cp .env.example .env.local     # add your Anthropic API key
npm run method:check           # validate the method, see what is still open
npm run db:generate            # generate the Prisma client
npm run db:migrate             # create the local SQLite database
npm run seed                   # the worked example
npm run dev                    # http://localhost:3000
```

## Screens

| Screen | What it is for |
| --- | --- |
| Library (`/`) | Every document, filterable, with version history per source |
| Intake (`/intake`) | Paste a source, tag it, choose a target profile |
| Pipeline (`/runs/[id]`) | Run and re-run stages, inspect the change plan, resolve fidelity flags |
| Review (`/runs/[id]/review`) | Source and adaptation side by side; accept / reject / edit each change |
| Governance (`/runs/[id]/governance`) | The printable record; store an immutable copy |
| Method (`/method`) | The rules as loaded, and the refinement queue rejections feed |

## Running the pipeline from the command line

```sh
npm run adapt -- --file seed/heart-health-brochure.md \
  --title "Understanding Your Heart Risk" \
  --condition "Cardiovascular disease" \
  --org "Northern Metropolitan Health Service" \
  --audience "Adults at raised cardiovascular risk"

# it stops after stage 3 so you can inspect the plan, then:
npm run adapt -- --run <runId> --continue
npm run adapt -- --run <runId> --stage VERIFY     # re-run one stage
```

## The pipeline

Six discrete, individually inspectable, individually re-runnable stages. Each
persists its rendered prompt, prompt hash, model, input, output and raw
response.

| # | Stage | What it does |
| --- | --- | --- |
| 1 | Extract | Parse the source into atomic clinical assertions with stable IDs. This list is the safety contract. |
| 2 | Analyse | Reading level, sentence distribution, risk format, addressee, cultural assumptions, idiom, jargon. |
| 3 | Plan | Which rules fire and what each will change, *before* any rewriting. Inspectable and editable. |
| 4 | Rewrite | Execute the approved plan. |
| 5 | Verify | Independently re-extract assertions from the adaptation and hunt for drift. No sight of the plan. |
| 6 | Back-translate | Where a target language is involved, translate back and diff the assertions again. |

Stage 5 is two calls: an independent re-extraction from the adapted text, then
an adversarial match against the stage-1 list. Neither sees the change plan.

A document cannot reach review with unresolved fidelity flags, and there is no
override (D-08).

## The first target

A cardiovascular risk and prevention brochure, adapted to Grade 5-6 reading
level with CALD framing, in English, no translation. Reviewed in full by the
method author; final spot-check by a bilingual community reviewer.

## Non-goals

No multi-tenancy, no billing, no deployment, no auth, no fine-tuning, no
media generation. This is an adaptation engine with a governance record.
