// ---------------------------------------------------------------------------
// Public entry point. Assembles the daily card from the independent tracks:
//   triage gate  →  escalation gate  →  duration + cue + chew + re-entry.
//
// The engine produces grounded instructions and a target number. The brand-
// voice rewrite of the card, the free-text parsing, and "why did she do that?"
// are the LLM's job — and none of them may change the number.
// ---------------------------------------------------------------------------

import { DEFAULT_CONFIG, type EngineConfig } from './config.js';
import { computeCueState, cueWord } from './cue.js';
import { assessEscalation, trailingDistressStreak } from './escalation.js';
import {
  computeDurationTarget,
  frontier,
  type DurationDecision,
} from './progression.js';
import { assessTriage } from './triage.js';
import type {
  DailyPlan,
  Outcome,
  Profile,
  Referral,
  SessionLog,
} from './types.js';

export * from './types.js';
export { DEFAULT_CONFIG } from './config.js';
export type { EngineConfig } from './config.js';
export { frontier } from './progression.js';
export { assessTriage } from './triage.js';
export { assessEscalation, trailingDistressStreak } from './escalation.js';

// --- Re-entry copy, grounded per last outcome ---------------------------------

const REENTRY: Record<Outcome | 'none', string> = {
  none: 'Come back in calm and quiet. A soft hello, then get on with things — a low-key return teaches her that comings and goings are ordinary.',
  settled:
    'Come back in calm and low-key. A quiet hello, then carry on. Big reunions make the leaving feel like a bigger deal than it was.',
  stirred:
    'Keep your return boring. Wait for four paws on the floor and one calm breath before you greet her, so calm is what gets the hello.',
  distressed:
    "Come back before it tips over next time. Greet her gently — no scolding, no drama — then keep the next rep shorter. She isn't being naughty; she got out of her depth.",
};

function reentryFor(history: ReadonlyArray<SessionLog>): string {
  const last = history[history.length - 1];
  return REENTRY[last ? last.outcome : 'none'];
}

// --- Chew: training wheels, used early / on hard days, faded as calm builds ---

interface ChewDecision {
  recommended: boolean;
  note: string;
}

function chewFor(
  history: ReadonlyArray<SessionLog>,
  profile: Profile,
  frontierSeconds: number,
  config: EngineConfig,
): ChewDecision {
  if (!profile.useChew) {
    return { recommended: false, note: '' };
  }

  const last = history[history.length - 1];
  const hardDay = last?.outcome === 'distressed';
  const early = frontierSeconds < config.chewFadeThresholdSeconds;

  if (early) {
    return {
      recommended: true,
      note: 'Give a Rosie Bear chew about 30–60 minutes before this rep. Early on it helps keep the session under threshold — think training wheels, not a crutch.',
    };
  }
  if (hardDay) {
    return {
      recommended: true,
      note: "Yesterday was a hard one, so bring the chew back for today only — 30–60 minutes before. We'll set it aside again once she's steady.",
    };
  }
  return {
    recommended: false,
    note: "She's holding longer stretches now, so we're fading the chew out — no chew for this rep. Keep it for the occasional hard day.",
  };
}

// --- Missed-day helper --------------------------------------------------------

/** Whole days between two ISO dates (today - lastSession). Null if no history. */
export function daysSinceLast(
  history: ReadonlyArray<SessionLog>,
  today: string,
): number | null {
  const last = history[history.length - 1];
  if (!last) return null;
  const ms = Date.parse(today) - Date.parse(last.date);
  return Math.max(0, Math.round(ms / 86_400_000));
}

// --- The one public function --------------------------------------------------

export interface ComputeOptions {
  config?: EngineConfig;
  /** Explicit RNG seed (tests / reproducible sims). Omit in production. */
  seed?: number;
}

/**
 * Produce today's plan. `today` is passed in (ISO date) — the engine never
 * reads the clock, so the same inputs always yield the same plan.
 */
export function computeDailyPlan(
  history: ReadonlyArray<SessionLog>,
  profile: Profile,
  today: string,
  options: ComputeOptions = {},
): DailyPlan {
  const config = options.config ?? DEFAULT_CONFIG;

  // 1. Intake triage gate — do not enrol on any red flag.
  const triage = assessTriage(profile);
  const cue = computeCueState(history, profile.firstDepartureCue);

  if (!triage.enrol) {
    return referPlan(today, triage.referral!, profile, history, config, cue);
  }

  // 2. Mid-program welfare escalation — halt on a distress streak.
  const escalation = assessEscalation(history, config);
  if (escalation) {
    return haltPlan(today, escalation, profile, history, config, cue);
  }

  // 3. Active plan.
  const gap = daysSinceLast(history, today);
  const decision: DurationDecision = computeDurationTarget(
    history,
    profile,
    config,
    gap,
    options.seed,
  );
  const chew = chewFor(history, profile, decision.frontierSeconds, config);

  return {
    date: today,
    status: 'active',
    targetSeconds: decision.targetSeconds,
    frontierSeconds: decision.frontierSeconds,
    cueToWork: profile.firstDepartureCue,
    cueStep: cue.step,
    cueInstruction: cue.instruction,
    cueMastered: cue.mastered,
    reentryInstruction: reentryFor(history),
    chewRecommended: chew.recommended,
    chewNote: chew.note,
    referral: null,
    rationale: {
      move: decision.move,
      frontierSeconds: decision.frontierSeconds,
      ceilingSeconds: decision.ceilingSeconds,
      daysSinceLastSession: gap,
      consecutiveDistress: trailingDistressStreak(history),
    },
  };
}

function referPlan(
  today: string,
  referral: Referral,
  profile: Profile,
  history: ReadonlyArray<SessionLog>,
  config: EngineConfig,
  cue: ReturnType<typeof computeCueState>,
): DailyPlan {
  return blockedPlan('refer', today, referral, profile, history, config, cue);
}

function haltPlan(
  today: string,
  referral: Referral,
  profile: Profile,
  history: ReadonlyArray<SessionLog>,
  config: EngineConfig,
  cue: ReturnType<typeof computeCueState>,
): DailyPlan {
  return blockedPlan('halted', today, referral, profile, history, config, cue);
}

function blockedPlan(
  status: 'refer' | 'halted',
  today: string,
  referral: Referral,
  profile: Profile,
  history: ReadonlyArray<SessionLog>,
  config: EngineConfig,
  cue: ReturnType<typeof computeCueState>,
): DailyPlan {
  const front = frontier(history, profile, config);
  return {
    date: today,
    status,
    targetSeconds: 0, // no rep is prescribed while blocked
    frontierSeconds: front,
    cueToWork: profile.firstDepartureCue,
    cueStep: cue.step,
    cueInstruction: '',
    cueMastered: cue.mastered,
    reentryInstruction: '',
    chewRecommended: false,
    chewNote: '',
    referral,
    rationale: {
      move: 'hold',
      frontierSeconds: front,
      ceilingSeconds: Math.floor(front * config.ceilingFactor),
      daysSinceLastSession: daysSinceLast(history, today),
      consecutiveDistress: trailingDistressStreak(history),
    },
  };
}

// --- Weekly view metric -------------------------------------------------------
// The one number that shows progress: the longest calm absence over time,
// measured from what the dog actually ACHIEVED (settled reps), not what was
// prescribed.

export interface WeeklyPoint {
  /** ISO date of the Monday that starts the week bucket. */
  weekStart: string;
  /** Longest settled absence (seconds) achieved that week, or 0 if none. */
  longestCalmAbsenceSeconds: number;
  sessions: number;
}

/** Longest settled absence across the whole history, in seconds. */
export function longestCalmAbsence(
  history: ReadonlyArray<SessionLog>,
): number {
  let best = 0;
  for (const s of history) {
    if (s.outcome === 'settled' && s.targetSeconds > best) {
      best = s.targetSeconds;
    }
  }
  return best;
}

/** ISO date of the Monday on or before `iso`. */
function weekStartOf(iso: string): string {
  const d = new Date(Date.parse(iso));
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/** Group settled reps into weekly buckets for the progress chart. */
export function weeklySeries(
  history: ReadonlyArray<SessionLog>,
): WeeklyPoint[] {
  const byWeek = new Map<string, WeeklyPoint>();
  for (const s of history) {
    const wk = weekStartOf(s.date);
    const point =
      byWeek.get(wk) ??
      { weekStart: wk, longestCalmAbsenceSeconds: 0, sessions: 0 };
    point.sessions += 1;
    if (s.outcome === 'settled') {
      point.longestCalmAbsenceSeconds = Math.max(
        point.longestCalmAbsenceSeconds,
        s.targetSeconds,
      );
    }
    byWeek.set(wk, point);
  }
  return [...byWeek.values()].sort((a, b) =>
    a.weekStart < b.weekStart ? -1 : 1,
  );
}
