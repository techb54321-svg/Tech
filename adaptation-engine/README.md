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

**Stage 1 of 3 complete: method files and data model.** No pipeline yet, no UI
yet, no dependencies installed beyond what validates the method. See
`DECISIONS.md`, D-14 for the build order.

## Layout

```
method/            THE PRODUCT — versioned adaptation rules, editable by hand
  METHOD.md        how to read and edit them
prisma/
  schema.prisma    the data model, and the audit trail's shape
src/method/        loads, validates and hashes the method files
scripts/
  check-method.ts  npm run method:check
DECISIONS.md       every architectural choice and why
```

## Getting started

```sh
npm install
cp .env.example .env.local     # add your Anthropic API key
npm run method:check           # validate the method, see what is still open
npm run db:generate            # generate the Prisma client
npm run db:migrate             # create the local SQLite database
```

## The pipeline (stage 2, not yet built)

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

A document cannot reach review with unresolved fidelity flags, and there is no
override (D-08).

## The first target

A cardiovascular risk and prevention brochure, adapted to Grade 5-6 reading
level with CALD framing, in English, no translation. Reviewed in full by the
method author; final spot-check by a bilingual community reviewer.

## Non-goals

No multi-tenancy, no billing, no deployment, no auth, no fine-tuning, no
media generation. This is an adaptation engine with a governance record.
