# The method

These files are the product. Everything else in this repository is machinery
for executing them and proving they were executed.

You can edit any file here in a text editor. No code changes are needed, and no
rule text is duplicated anywhere in the codebase — the pipeline reads these
files at run time and interpolates them into its prompts.

After any edit, run:

```
npm run method:check
```

It validates every file and prints what state the method is in, including which
rules are still the engine author's guesses rather than yours.

## Layout

```
method/
  method.yaml                  manifest: version, status, dimensions, profiles
  METHOD.md                    this file
  rules/                       one file per dimension
    reading-level.yaml         RL-*
    numeracy-and-risk.yaml     NUM-*
    addressee.yaml             ADR-*
    agency-and-framing.yaml    AGY-*
    food-and-mealtimes.yaml    FOOD-*
    religion-and-calendar.yaml CAL-*
    idiom-and-metaphor.yaml    IDM-*
    register-and-formality.yaml REG-*
    trust-and-messenger.yaml   TRUST-*
    never-soften.yaml          NS-*   (overrides everything above)
  data/
    food-substitutions.yaml    the signed-off substitution list
    rejection-taxonomy.yaml    the codes a reviewer picks when rejecting
```

## Anatomy of a rule

```yaml
- id: NUM-01                 # permanent. Never reuse an ID, even after deletion.
  title: ...                 # short, for the review screen
  status: confirmed          # confirmed | assumed | strawman — see below
  source: ...                # where this rule came from, and when
  blocking: true             # optional. Violating it stops the document.
  tier: 1                    # never-soften rules only: 1 = protected, 2 = verbatim
  statement: |               # executable by someone who has never met you
    ...
  rationale: |               # why. Appears in the governance record.
    ...
  example:                   # at least before/after. "wrong:" is encouraged.
    before: ...
    after: ...
    wrong: ...
```

**Write the statement so a stranger could execute it.** "Make it culturally
appropriate" is not a rule. "Replace percentage risk with a whole number out of
100, phrased as a room of 100 people" is.

**The `wrong:` example earns its place.** Several rules exist only to prevent a
specific plausible-looking failure, and the counter-example is the clearest way
to say what that failure is.

## Rule status

| status | meaning |
| --- | --- |
| `confirmed` | You stated this explicitly. |
| `assumed` | Proposed to you as a working default; you did not object. Executes, marked as assumed on the governance record. |
| `strawman` | Written by the engine author. You have **not** confirmed it. Executes, and every change it produces is tagged "unconfirmed rule" in the review screen. |

The point of the three-way split is that you can look at any adaptation and see
how much of it rests on rules you actually agreed to. As you work through the
strawman rules, change the status and replace the `source:` line.

## Precedence

1. **never-soften (NS-\*) beats everything.** Where a reading-level or framing
   rule conflicts with an NS rule, the NS rule wins and the conflict is
   recorded as something the reviewer must see.
2. **Data files bound rules.** FOOD-01 cannot fire without a signed-off entry;
   TRUST-01 cannot fire without a messenger on the profile. A rule with no data
   behind it flags instead of acting.
3. **Nothing invents clinical content.** Several rules (NUM-02, NUM-03, AGY-03,
   REG-03) stop short of improving the text because completing it would require
   asserting something the source does not say. That restraint is the method,
   not a limitation of it.

## Versioning

`method_version` in `method.yaml` is the human-readable version. Bump it when
you change a rule's meaning; you do not need to bump it for typos.

Because you can edit these files without bumping the version, every adaptation
run also records a SHA-256 over the full text of every method file, and stores a
complete copy of them. Two runs claiming the same `method_version` but showing
different hashes is a detectable, visible condition rather than a silent one.

## What is still missing from v1

Run `npm run method:check` for the live list. As of method 0.1.0:

- The community for the first profile is not named, so no food substitution can
  fire and every food example will be flagged.
- The messenger for the first profile is not set, so TRUST-01 does not fire.
- The idiom seed list in `idiom-and-metaphor.yaml` is the engine author's
  invention and needs replacing with real observed examples.
- Of 48 rules, 13 are `confirmed`, 9 are `assumed` and 26 are `strawman`.
