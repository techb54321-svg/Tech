# Decisions

Every architectural choice and its reasoning, newest section last. Each entry
records what was decided, why, and what would make us revisit it.

---

## D-01 — The method lives in editable files, not in code or in the database

**Decided:** the adaptation rules live in `method/*.yaml` as plain text. No rule
text is duplicated in TypeScript, in a prompt template, or in a seed script.
The pipeline reads the files at run time and interpolates them into prompts.

**Why:** the defensible asset is the method. It has to be editable by the
person who owns it without touching code, reviewable by people who will never
open an editor, and diffable in version control so that "what changed between
March and June" is answerable. Putting rules in prompts would make the prompt
the source of truth, which means the method could drift without anyone
noticing.

**Revisit if:** the rule files grow past the point where a single YAML file per
dimension is readable, or if rules need conditional logic beyond "fires for
this profile".

---

## D-02 — Three-state rule provenance: confirmed / assumed / strawman

**Decided:** every rule carries a status saying whether the method author
stated it, was offered it as a default and did not object, or has never seen it
confirmed. Unconfirmed rules still execute, but every change they produce is
tagged as coming from an unconfirmed rule.

**Why:** the first version of any method is mostly the engine author's guesses.
Pretending otherwise produces a document that looks authoritative and is not.
Making provenance visible on every change means the method author can see
exactly how much of an adaptation rests on their own judgement, and the
governance record can state it honestly to a committee.

**Revisit if:** the proportion of strawman rules approaches zero, at which point
the distinction stops earning its complexity.

---

## D-03 — Rule IDs are permanent

**Decided:** rule IDs (`NUM-01`) are never reused, even after a rule is
deleted. The loader errors on a duplicate.

**Why:** every change, every fidelity flag and every refinement candidate cites
a rule ID, and those citations have to keep meaning the same thing in a
governance record printed two years from now.

---

## D-04 — Runs record both a method version and a method content hash, and
store the full method text

**Decided:** `MethodSnapshot` holds a SHA-256 over every method file plus a
complete copy of their text. Runs point at a snapshot, not at the files.

**Why:** the files are editable by design (D-01), so a version number alone
cannot be trusted — a rule can change without the version moving. The hash
makes that detectable; the stored copy makes the run reproducible after the
files have moved on. This is what lets the answer to "why does this sentence
say this?" survive later method edits.

---

## D-05 — Target profiles are copied into the database, not read live

**Decided:** profiles are defined in `method.yaml` and copied into
`TargetProfile` rows at seed time. Runs reference the row.

**Why:** same reason as D-04. Editing a profile should not silently rewrite the
description of an adaptation that already happened.

**Cost:** a profile edit needs a re-seed to take effect for new runs. Accepted;
it is one command, and the alternative is mutable history.

---

## D-06 — SQLite via Prisma, with String columns instead of enums and JSON

**Decided:** status-like fields are `String` with permitted values documented
in a comment directly above them; structured payloads are `String` holding
JSON.

**Why:** Prisma's SQLite provider supports neither `enum` nor `Json`. The
alternatives — Postgres in Docker, or an ORM change — both cost more than they
return for a single-user local app. Documenting the vocabulary in the schema
next to the column keeps it discoverable.

**Revisit if:** this ever becomes multi-user or hosted, at which point Postgres
brings back enums, real JSON columns and constraint checking.

---

## D-07 — The pipeline is six persisted stages, not one call

**Decided:** extract → analyse → plan → rewrite → verify → back-translate. Each
stage persists its rendered prompt, prompt hash, model, inputs, outputs, raw
response and token counts to `StageRun`, and each is independently re-runnable
with an incrementing `attempt`.

**Why:** three reasons, in order of importance. (1) Verification must be
independent: stage 5 cannot be trusted if it can see the change plan that
produced the text. (2) A stage that can be inspected and re-run is a stage that
can be debugged; one giant prompt can only be replaced. (3) The governance
record needs to show which model produced which artifact, and a single call
collapses that into an unanswerable question.

---

## D-08 — Blocking fidelity flags have no override

**Decided:** a run with any open `AssertionCheck` where `blocking = true`
cannot reach `REVIEW_COMPLETE`. There is no accept-anyway control, and no
reviewer role can dismiss one. Resolution means the text is corrected and the
fidelity stage is re-run, or the flag is withdrawn as a false positive with a
written reason — which is itself recorded.

**Why:** an override that exists will be used at 5pm before a meeting. The
product's entire claim to a clinical governance committee is that clinical
meaning cannot drift through this system unnoticed, and a dismiss button
converts that claim into a policy.

**Cost:** false positives from stage 5 will be genuinely annoying, and the
adversarial prompting will produce them. Accepted: withdrawing a flag with a
reason is a recorded, reviewable act, and the withdrawal rate per rule is
itself a signal about the fidelity prompt.

---

## D-09 — Stage 5 runs adversarially and without sight of the plan

**Decided:** the verification stage receives the source assertions and the
adapted text, and nothing else — not the change plan, not the analysis, not the
rules that fired. It is prompted to hunt for drift, not to confirm success.

**Why:** a verifier that can see the plan will confirm the plan. Withholding it
is the only structural guarantee available in a system where the same model
family does both jobs.

---

## D-10 — Relative risk is carried through, and the cost is counted

**Decided:** per the method author, relative-risk claims with no absolute
numbers in the source are carried through unchanged (NUM-03), while absolute
risks become natural frequencies out of 100 (NUM-01). Every carried-through
claim is recorded as `RELATIVE_RISK_CARRIED` on the governance record.

**Why:** converting requires a baseline the document does not contain, which
would mean the engine asserting a clinical number on its own authority. The
known cost is that a document can contain two risk formats, which is a real
comprehension problem. Counting the instances turns that from an unexamined
trade-off into evidence for revisiting the rule in v0.2.

---

## D-11 — The engine flags rather than guesses, in five specific places

**Decided:** where completing an improvement would require asserting something
the source does not say, the engine stops and raises a flag for a human:
missing denominators (NUM-02), food substitutions with no signed-off entry
(FOOD-02) or no portion equivalence (FOOD-03), fasting and medication timing
(CAL-01), and instructions whose reason the source never gives (REG-03).

**Why:** these are the points where a language model will produce fluent,
plausible, unsourced clinical content, and where a reviewer is least likely to
catch it, because the invented sentence reads better than the honest one.

**Side benefit:** the flags from the first real document are the worklist for
building the substitution list, which is otherwise a blank page.

---

## D-12 — Reviewer rejections use a fixed taxonomy plus free text

**Decided:** rejecting a change requires one code from
`method/data/rejection-taxonomy.yaml` and free text. `CLINICAL_DRIFT`
additionally raises a blocking fidelity flag and returns the document to
blocked.

**Why:** free text alone does not aggregate. The codes are chosen so that each
one implies a different repair: narrow a rule's scope, clarify its statement,
fix the fidelity prompt, add a data-file entry. `CLINICAL_DRIFT` escalating is
what closes the loop between human review and the automated safety net — every
instance is a hole in stage 5.

---

## D-13 — Governance records are stored as rendered snapshots

**Decided:** `GovernanceRecord` stores the full payload JSON and its hash, not
just a pointer to the run.

**Why:** a record handed to a committee has to be reproducible byte for byte
later. Regenerating from live tables would produce a different document as soon
as anything downstream changed.

---

## D-14 — Build order: method files and data model, then a CLI pipeline, then
the UI

**Decided:** no Next.js dependency is installed yet. Stage 1 is the method
files, the schema and the loader. Stage 2 is the pipeline as a CLI runnable
against one real document. Stage 3 is the web app.

**Why:** the UI is the most expensive thing to build and the least useful if
the pipeline's output is not yet good. The review screen's design depends on
what the change list actually looks like on a real brochure, which is not
knowable in advance.

---

## D-15 — Two model variables, one for rewriting and one for verification

**Decided:** `ADAPTATION_MODEL` and `FIDELITY_MODEL` are separate environment
variables, both recorded per stage on the governance record.

**Why:** the verification stages are the safety net and should run on the
strongest model available. Keeping them separate makes it visible on the record
whether verification ran on a weaker model than the rewrite, which is the kind
of cost-saving that would otherwise be invisible to a committee.
