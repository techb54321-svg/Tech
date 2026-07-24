// ---------------------------------------------------------------------------
// The duration track: given (history, profile, config, seed) → today's target.
//
// Pure. Deterministic. The ONLY place a target number is decided — and it is
// decided by rules, never by a model. The hard invariant it upholds:
//
//     target <= frontier(history) * config.ceilingFactor
//
// for every possible input. Overshooting sensitises the dog, so every branch
// rounds DOWN and the ceiling is clamped last, unconditionally.
//
// The "frontier" is the current WORKING anchor for progression — not the all-
// time best. It is adaptive: a settled rep can raise it, and a distressed rep
// KNOCKS IT DOWN (the dog must re-prove above that level). Without this, a
// single bad day would leave a stale high anchor and every recovery would leap
// straight back to the level that just failed — re-sensitising the dog. The
// all-time best (for the progress chart) is tracked separately by
// `longestCalmAbsence` in index.ts.
// ---------------------------------------------------------------------------

import type { EngineConfig } from './config.js';
import { mulberry32, seedFromHistory, uniform } from './rng.js';
import type { ProgressionMove, Profile, SessionLog } from './types.js';

export interface DurationDecision {
  targetSeconds: number;
  frontierSeconds: number;
  ceilingSeconds: number;
  move: ProgressionMove;
}

/** The conservative starting rung: well under the untested self-reported baseline. */
export function startRung(profile: Profile, config: EngineConfig): number {
  return Math.max(
    config.minTargetSeconds,
    Math.floor(profile.baselineCalmSeconds * config.startFactor),
  );
}

/**
 * Replay history to find the current working frontier.
 *   settled    → raise the frontier to that duration.
 *   distressed → knock it down to min(frontier, failedTarget) * dropFactor.
 *   stirred    → no change (a plateau, handled by the hold rule).
 * Floored at the starting rung so we never anchor below where we'd begin.
 */
export function frontier(
  history: ReadonlyArray<SessionLog>,
  profile: Profile,
  config: EngineConfig,
): number {
  let f = startRung(profile, config);
  for (const s of history) {
    if (s.outcome === 'settled') {
      f = Math.max(f, s.targetSeconds);
    } else if (s.outcome === 'distressed') {
      const knocked = Math.floor(
        Math.min(f, s.targetSeconds) * config.distressDropFactor,
      );
      f = Math.max(config.minTargetSeconds, knocked);
    }
  }
  return f;
}

/**
 * Increment band scaled by realistic availability. An owner who can manage one
 * session a week climbs in smaller steps than one doing five — fewer reps to
 * consolidate each gain, so we consolidate more. Never widens the band beyond
 * the configured max (the ceiling invariant depends on that).
 */
function availabilityFactor(profile: Profile, config: EngineConfig): number {
  const raw = profile.weeklyAvailability / config.referenceSessionsPerWeek;
  return clamp(raw, config.minAvailabilityFactor, 1);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Whole seconds, floored, never below the configured floor. */
function floorTarget(x: number, config: EngineConfig): number {
  return Math.max(config.minTargetSeconds, Math.floor(x));
}

/**
 * Compute today's target.
 *
 * @param seed  Optional explicit seed. When omitted, derived from history so
 *              the same history is always reproducible while consecutive days
 *              draw different increments. Tests pass a seed to force a branch.
 */
export function computeDurationTarget(
  history: ReadonlyArray<SessionLog>,
  profile: Profile,
  config: EngineConfig,
  daysSinceLastSession: number | null,
  seed?: number,
): DurationDecision {
  const front = frontier(history, profile, config);
  const ceiling = Math.floor(front * config.ceilingFactor);

  const finish = (
    rawTarget: number,
    move: ProgressionMove,
  ): DurationDecision => {
    // The invariant, enforced unconditionally and last.
    const clamped = Math.min(floorTarget(rawTarget, config), ceiling);
    return {
      targetSeconds: clamped,
      frontierSeconds: front,
      ceilingSeconds: ceiling,
      move,
    };
  };

  // No history: conservative starting rung, well under the untested baseline.
  if (history.length === 0) {
    return finish(startRung(profile, config), 'first');
  }

  const last = history[history.length - 1]!;

  // Returning after a gap: gentle re-warm below the frontier, no penalty, no
  // guilt. Missed days are expected.
  if (
    daysSinceLastSession !== null &&
    daysSinceLastSession >= config.reWarmGapDays
  ) {
    return finish(front * config.reWarmFactor, 're-warm');
  }

  // Distress: the frontier has already been knocked down to the re-proving
  // level, so today's rep repeats there. Rebuild upward from a level the dog
  // can actually hold, rather than leaping back to what just failed.
  if (last.outcome === 'distressed') {
    return finish(front, 'drop');
  }

  // Settled-but-slow counts as a hold, not a climb — another way to err short.
  const settledButSlow =
    last.outcome === 'settled' &&
    last.timeToSettleSeconds > last.targetSeconds * config.settleSlowRatio;

  // Stirred, or settled-but-slow: repeat, don't push.
  if (last.outcome === 'stirred' || settledButSlow) {
    return finish(last.targetSeconds, 'hold');
  }

  // Clean settled rep → either a randomised climb or a deliberate short rep.
  const rand = mulberry32(
    seed ??
      seedFromHistory([
        history.length,
        front,
        last.targetSeconds,
        last.outcome,
      ]),
  );

  // Only inject a short rep after a rep at/near the frontier (a "longer" one),
  // and never two short reps in a row.
  const lastWasShort = last.targetSeconds < front * 0.85;
  if (!lastWasShort && rand() < config.shortRepProb) {
    const factor = uniform(
      rand,
      config.shortRepMinFactor,
      config.shortRepMaxFactor,
    );
    return finish(front * factor, 'short-rep');
  }

  const avail = availabilityFactor(profile, config);
  const pct = uniform(rand, config.incMinPct, config.incMaxPct) * avail;
  return finish(front * (1 + pct), 'climb');
}
