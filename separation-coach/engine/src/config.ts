// ---------------------------------------------------------------------------
// Every tunable number lives here, in one place, so the protocol can be tuned
// against the simulation without touching engine logic. Defaults are
// deliberately conservative: the engine always errs short. Overshooting
// sensitises the dog and is worse than doing nothing.
// ---------------------------------------------------------------------------

export interface EngineConfig {
  // --- Starting point ---
  /**
   * First rep = baselineCalmSeconds * startFactor. We start well under the
   * owner's self-reported baseline and re-prove calm from there.
   */
  startFactor: number;
  /** Absolute floor for any target. */
  minTargetSeconds: number;

  // --- Climb (on a settled rep) ---
  /** Increment drawn uniformly from [incMinPct, incMaxPct] of the frontier. */
  incMinPct: number;
  incMaxPct: number;
  /**
   * HARD INVARIANT. Today's target may never exceed frontier * ceilingFactor.
   * Must be >= 1 + incMaxPct so a normal climb is always within the ceiling.
   * This is the "targets never jump beyond the configured ceiling" guarantee.
   */
  ceilingFactor: number;

  // --- Short reps (unpredictability) ---
  /** Probability that a settled rep is followed by a deliberate shorter rep. */
  shortRepProb: number;
  /** A short rep lands uniformly in [shortRepMinFactor, shortRepMaxFactor] * frontier. */
  shortRepMinFactor: number;
  shortRepMaxFactor: number;

  // --- Distress ---
  /** On a distressed rep, drop to frontier * distressDropFactor and rebuild. */
  distressDropFactor: number;

  // --- Settled-but-slow guard ---
  /**
   * If a rep settled but took longer than target * settleSlowRatio to settle,
   * treat it as a hold rather than a climb. Another way of erring short.
   */
  settleSlowRatio: number;

  // --- Missed days ---
  /** A gap of this many days or more triggers a gentle re-warm rep. */
  reWarmGapDays: number;
  /** Re-warm rep = frontier * reWarmFactor (below the frontier, no penalty). */
  reWarmFactor: number;

  // --- Availability pacing ---
  /** Sessions/week that count as "full" pacing; fewer slows the climb. */
  referenceSessionsPerWeek: number;
  /** Availability never shrinks the increment band below this fraction. */
  minAvailabilityFactor: number;

  // --- Welfare escalation ---
  /** This many consecutive distressed reps halts the program → referral. */
  consecutiveDistressLimit: number;

  // --- Chew fade ---
  /**
   * While the frontier is below this, the chew is recommended by default
   * (early days). Above it, the chew is faded out except on hard days.
   */
  chewFadeThresholdSeconds: number;

  // --- Owner-effort budget (informational in v1) ---
  /** ~5 minutes: the daily owner-effort budget the UI paces reps against. */
  sessionCapSeconds: number;
}

export const DEFAULT_CONFIG: EngineConfig = {
  startFactor: 0.5,
  minTargetSeconds: 5,

  incMinPct: 0.1,
  incMaxPct: 0.2,
  ceilingFactor: 1.25, // > 1 + incMaxPct (1.20), so a normal climb never clips it

  shortRepProb: 0.25,
  shortRepMinFactor: 0.4,
  shortRepMaxFactor: 0.6,

  distressDropFactor: 0.5,

  settleSlowRatio: 1.0,

  reWarmGapDays: 3,
  reWarmFactor: 0.8,

  referenceSessionsPerWeek: 5,
  minAvailabilityFactor: 0.5,

  consecutiveDistressLimit: 3,

  chewFadeThresholdSeconds: 180,

  sessionCapSeconds: 300,
};
