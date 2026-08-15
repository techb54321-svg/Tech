# Seed data

## `heart-health-brochure.md` is synthetic

It was written for this repository to look like a real Australian
cardiovascular prevention brochure, and it is **not** a real document from any
health service. "Northern Metropolitan Health Service" does not exist.

It carries, on purpose, the failure modes the method exists to fix: risk as a
percentage and as unconvertible relative risk, a university-level opening
paragraph, fatalistic framing, Australian idiom, a Christmas reference, food
examples with no cultural range, third-person passive instruction, a vague
appeal to research, and — in the sections that matter most — dosing, a
do-not-stop instruction and an emergency symptom list that must survive
adaptation untouched.

Replace it with the real brochure as soon as you have one. Nothing in the code
depends on this file.

## The seeded worked example was hand-authored, not model-generated

The two runs created by `npm run seed` were written by hand so the app is
demonstrable from first run without an API key. Every stage row in them records
`model: hand-authored-seed`, and the governance record shows that value where a
real run would show a model ID. They are labelled as demonstrations in the
document notes.

They are faithful to what the pipeline does, and the fidelity flags in version 1
are the drift the method is designed to catch:

- **Version 1 — BLOCKED.** Three fidelity flags: the ambulance instruction lost
  its urgency word (WEAKENED, NS-01), the do-not-stop instruction lost "even if
  you feel well" (CONDITION_DROPPED, NS-04), and a reassurance appeared that the
  source never made (INVENTED).
- **Version 2 — IN REVIEW.** The same source re-run with those three corrected,
  every assertion present and unchanged, and a change list waiting for review.

To replace them with a real run once your API key is set:

```sh
npm run adapt -- --file seed/heart-health-brochure.md \
  --title "Understanding Your Heart Risk" \
  --condition "Cardiovascular disease" \
  --org "Northern Metropolitan Health Service" \
  --audience "Adults at raised cardiovascular risk"
```
