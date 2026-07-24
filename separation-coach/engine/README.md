# Rosie Bear Separation Coach — progression engine

Phase 1 of the Separation Coach: the **deterministic progression engine**,
its schema, its tests, and a runnable 6-week simulation. No UI yet — per the
build brief, the engine's behaviour is the thing to agree on before any screens.

The engine is **framework-agnostic pure TypeScript** with zero app
dependencies. Whatever we build the app in (SvelteKit is the proposal), this
package drops in unchanged, and it is the *only* place a duration number is ever
decided. A model never chooses the number.

```bash
npm install
npm run sim        # print the 6-week simulation (steady, regression, triage)
npm test           # 46 unit + property tests
npm run typecheck
```

## What the engine guarantees

- **The hard invariant:** `target ≤ frontier(history) × ceilingFactor`, for
  *every* input. Enforced by an unconditional clamp and proven by a property
  test over 5,000 adversarial histories plus 300 engine-driven runs
  (`test/progression.test.ts`). Overshooting sensitises the dog, so the engine
  always errs short and rounds down.
- **Deterministic randomness.** Increments are randomised (the dog must not
  predict the duration) but drawn from a seeded PRNG (`rng.ts`) seeded from the
  dog's own history — never `Math.random`. Same history → same plan. The clock
  is never read either; `today` is passed in. This is what makes it testable.
- **The number is rules-only.** The LLM's role (Phase 2) is narrow: parse
  free-text notes, write the card in brand voice, answer "why did she do that?"
  from logged history. None of that touches the target.

## The rules (`progression.ts`)

The **frontier** is the current *working* anchor — the longest duration the dog
has actually held calm. It is **adaptive**: a settled rep can raise it; a
distressed rep *knocks it down* so the dog re-proves gradually. Without this a
single bad day leaves a stale high anchor and every recovery leaps straight back
to the level that just failed — re-sensitising the dog. (The all-time best, for
the progress chart, is tracked separately by `longestCalmAbsence`.)

| Last rep | Move | Today's target |
|---|---|---|
| _none_ | `first` | `baseline × startFactor` — well under the *self-reported* baseline |
| settled | `climb` | frontier + small randomised increment (scaled by weekly availability) |
| settled | `short-rep` | occasional deliberate shorter rep, so duration stays unpredictable |
| settled-but-slow / stirred | `hold` | repeat — don't push |
| distressed | `drop` | frontier already knocked down → repeat at the re-proving level |
| _gap ≥ reWarmGapDays_ | `re-warm` | gentle rep below frontier, no penalty, no guilt |

Parallel and independent tracks:

- **Cue decoupling** (`cue.ts`) — a small ladder that breaks the departure-cue
  chain, advanced only by the `cueResult` on logged sessions. Never interferes
  with the duration track.
- **Chew** (`index.ts`) — recommended early and on hard days, deliberately faded
  as the frontier climbs past `chewFadeThresholdSeconds`. Training wheels, not a
  crutch. Off entirely if the owner opts out.

## Safety gates

- **Intake triage** (`triage.ts`) — any red flag (self-injury, exit-point
  destruction, refusing food when alone, elimination despite house-training)
  → **do not enrol**, route to a vet / veterinary behaviourist with a warm,
  non-alarming message.
- **Mid-program escalation** (`escalation.ts`) — `consecutiveDistressLimit`
  (default 3) distressed reps in a row → **halt** the program and refer. Because
  distress knocks the frontier down, a run of distress spans *decreasing*
  durations — the dog not coping even as we back off — which is the real welfare
  signal.

Both gates return `status: 'refer' | 'halted'` and prescribe **no rep**.

## Tuning

Every knob lives in `config.ts` (`DEFAULT_CONFIG`), so the protocol can be tuned
against the simulation without touching engine logic. Defaults are deliberately
conservative. `ceilingFactor` (1.25) must stay `> 1 + incMaxPct` (1.20) so a
normal climb never clips the ceiling.

## Decisions taken as conservative defaults (flag if you'd change them)

1. **Baseline is an estimate, not a proven ceiling.** All progression is
   anchored to durations the dog has *actually held* (`frontier`), starting at
   `baseline × 0.5`. We never prescribe near the untested self-reported baseline.
2. **Escalation triggers on 3 consecutive _distressed_ reps**, not on `stirred`
   plateaus (those are handled by `hold`). Stirred is stuck, not distress.
3. **Weekly availability slows the climb** (smaller increments), never speeds it.
4. **Weekly chart = achieved settled absences** (`longestCalmAbsence` /
   `weeklySeries`), not prescribed targets.
5. **`hasCamera` and `sessionCapSeconds` are informational in v1** — they shape
   copy and app-side scheduling, not the engine's number.

## Files

```
src/
  types.ts         Profile · SessionLog · DailyPlan · Referral · enums
  config.ts        every tunable, one place
  rng.ts           seeded PRNG + history hashing (deterministic randomness)
  progression.ts   the duration track + adaptive frontier + the ceiling invariant
  cue.ts           parallel cue-decoupling ladder
  triage.ts        intake red-flag gate
  escalation.ts    mid-program welfare halt
  index.ts         assembles the daily card; weekly-progress helpers
test/              46 unit + property tests
sim/simulate.ts    runnable seeded 6-week simulation (npm run sim)
```
