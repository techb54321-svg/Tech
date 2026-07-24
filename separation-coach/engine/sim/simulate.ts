// ---------------------------------------------------------------------------
// A runnable 6-week simulation of the engine driving a synthetic dog.
//
// The "dog" is a hidden-state responder (a rough behavioural model, NOT part of
// the product) so we can watch the engine's decisions play out over time:
// climbs, deliberate short reps, holds, drops after a bad day, graceful
// re-warms after a gap, and — critically — the welfare halt when a dog stops
// coping. Everything is seeded, so the trace is identical on every run.
//
//   npm run sim
// ---------------------------------------------------------------------------

import {
  computeDailyPlan,
  longestCalmAbsence,
  weeklySeries,
  type DailyPlan,
  type Outcome,
  type Profile,
  type SessionLog,
} from '../src/index.js';
import { mulberry32 } from '../src/rng.js';

// --- date helpers -------------------------------------------------------------

function addDays(iso: string, n: number): string {
  const d = new Date(Date.parse(iso));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// --- synthetic dog ------------------------------------------------------------

interface DogState {
  /** Hidden true tolerance in seconds — the longest absence the dog can hold. */
  tol: number;
}

/**
 * How the dog responds to a prescribed absence. Chew lifts effective tolerance
 * a little (keeping a session under threshold). Overshoot distresses — and a
 * distressed rep sensitises the dog (tolerance dips), which is exactly why the
 * engine errs short.
 */
function respond(
  state: DogState,
  target: number,
  chewUsed: boolean,
  rand: () => number,
): { outcome: Outcome; timeToSettleSeconds: number } {
  const noise = 0.92 + rand() * 0.16; // ±8%
  const eff = state.tol * (chewUsed ? 1.25 : 1) * noise;

  let outcome: Outcome;
  if (target <= eff * 0.9) outcome = 'settled';
  else if (target <= eff * 1.2) outcome = 'stirred';
  else outcome = 'distressed';

  // Consolidation / habituation / sensitisation.
  if (outcome === 'settled') state.tol += Math.max(2, target * 0.06);
  else if (outcome === 'stirred') state.tol += Math.max(1, target * 0.02); // habituates at a held level
  else state.tol = Math.max(6, state.tol * 0.85); // distress sensitises

  const timeToSettleSeconds =
    outcome === 'settled'
      ? Math.round(target * (0.2 + rand() * 0.3))
      : outcome === 'stirred'
        ? Math.round(target * (0.6 + rand() * 0.4))
        : target; // distressed: owner returns at the target mark

  return { outcome, timeToSettleSeconds };
}

// --- scenario driver ----------------------------------------------------------

export interface ScenarioResult {
  name: string;
  profile: Profile;
  logs: SessionLog[];
  plans: DailyPlan[];
  finalStatus: DailyPlan['status'];
}

export interface ScenarioSpec {
  name: string;
  profile: Profile;
  startDate: string;
  days: number;
  seed: number;
  /** Which day-indexes are session days (others are rest/missed). */
  isSessionDay: (dayIndex: number) => boolean;
  /** Hidden tolerance at the start. */
  startTolerance: number;
  /** Optional override of tolerance on a given day (models a regression). */
  toleranceOverride?: (dayIndex: number, state: DogState) => void;
}

export function runScenario(spec: ScenarioSpec): ScenarioResult {
  const rand = mulberry32(spec.seed);
  const state: DogState = { tol: spec.startTolerance };
  const logs: SessionLog[] = [];
  const plans: DailyPlan[] = [];
  let finalStatus: DailyPlan['status'] = 'active';

  for (let day = 0; day < spec.days; day++) {
    if (spec.toleranceOverride) spec.toleranceOverride(day, state);
    if (!spec.isSessionDay(day)) continue;

    const today = addDays(spec.startDate, day);
    const plan = computeDailyPlan(logs, spec.profile, today, {
      seed: (spec.seed ^ (day * 2654435761)) >>> 0,
    });
    plans.push(plan);
    finalStatus = plan.status;

    // Blocked (triage refer / welfare halt): stop the program.
    if (plan.status !== 'active') break;

    const { outcome, timeToSettleSeconds } = respond(
      state,
      plan.targetSeconds,
      plan.chewRecommended,
      rand,
    );

    // Cue track advances most sessions (settles), with the odd wobble.
    const cueResult: Outcome = rand() < 0.85 ? 'settled' : 'stirred';

    logs.push({
      date: today,
      targetSeconds: plan.targetSeconds,
      outcome,
      timeToSettleSeconds,
      cueResult,
      chewUsed: plan.chewRecommended,
    });
  }

  return {
    name: spec.name,
    profile: spec.profile,
    logs,
    plans,
    finalStatus,
  };
}

// --- scenarios ----------------------------------------------------------------

const BASE_PROFILE: Profile = {
  baselineCalmSeconds: 120,
  firstDepartureCue: 'keys',
  hasCamera: true,
  homeSetup: 'Second-floor apartment, free-roam, dog bed by the window',
  weeklyAvailability: 4,
  useChew: true,
  triageFlags: {
    selfInjury: false,
    exitPointDestruction: false,
    refusesFoodWhenAlone: false,
    eliminationDespiteHousetrained: false,
  },
};

/** 4 sessions/week (Mon/Tue/Thu/Sat), with a deliberate 4-day gap in week 3. */
function steadySchedule(dayIndex: number): boolean {
  // A busy stretch: skip days 15–19 to force a re-warm.
  if (dayIndex >= 15 && dayIndex <= 19) return false;
  const dow = dayIndex % 7; // 0=Mon (startDate is a Monday)
  return dow === 0 || dow === 1 || dow === 3 || dow === 5;
}

export function scenarioSteady(): ScenarioResult {
  return runScenario({
    name: 'Steady progress (6 weeks)',
    profile: BASE_PROFILE,
    startDate: '2026-01-05', // a Monday
    days: 42,
    seed: 0x1234_abcd,
    isSessionDay: steadySchedule,
    startTolerance: 75,
    // One ordinary bad day in week 4 — a delivery, a loud neighbour. A single
    // distress the engine drops for and recovers from, WITHOUT escalating.
    // This is the everyday judgment call the product is really for.
    toleranceOverride: (day, state) => {
      if (day === 24) state.tol *= 0.55;
    },
  });
}

export function scenarioRegression(): ScenarioResult {
  return runScenario({
    name: 'Regression → welfare halt',
    profile: BASE_PROFILE,
    startDate: '2026-01-05',
    days: 42,
    seed: 0x0bad_f00d,
    isSessionDay: steadySchedule,
    startTolerance: 75,
    // Week 4: something changes (a scare, a storm). Tolerance collapses and the
    // dog stops coping even with short absences.
    toleranceOverride: (day, state) => {
      if (day === 21) state.tol = 9;
      if (day >= 21) state.tol = Math.min(state.tol, 12);
    },
  });
}

export function scenarioTriage(): ScenarioResult {
  const profile: Profile = {
    ...BASE_PROFILE,
    triageFlags: { ...BASE_PROFILE.triageFlags, exitPointDestruction: true },
  };
  return runScenario({
    name: 'Intake triage — not enrolled',
    profile,
    startDate: '2026-01-05',
    days: 3,
    seed: 1,
    isSessionDay: () => true,
    startTolerance: 75,
  });
}

// --- pretty printing (CLI only) ----------------------------------------------

function fmt(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m${String(s).padStart(2, '0')}s`;
}

const MOVE_LABEL: Record<string, string> = {
  first: 'first rung',
  climb: 'climb',
  'short-rep': 'short rep',
  hold: 'hold',
  drop: 'DROP',
  're-warm': 're-warm',
};

function printScenario(r: ScenarioResult): void {
  console.log(`\n── ${r.name} ${'─'.repeat(Math.max(0, 46 - r.name.length))}`);

  // Blocked-at-intake case.
  if (r.plans[0] && r.plans[0].status === 'refer') {
    console.log(`  Status: NOT ENROLLED (${r.plans[0].referral?.reason})`);
    console.log(`  ${wrap(r.plans[0].referral?.message ?? '', 66, '  ')}`);
    return;
  }

  console.log(
    '  date        move        target   outcome     settle   frontier  ceil   chew',
  );
  console.log('  ' + '─'.repeat(76));

  let li = 0;
  for (const plan of r.plans) {
    if (plan.status !== 'active') {
      console.log(
        `  ${plan.date}  ⛔ HALTED  (${plan.referral?.reason})`,
      );
      console.log(`  ${wrap(plan.referral?.message ?? '', 66, '  ')}`);
      break;
    }
    const log = r.logs[li++];
    const move = MOVE_LABEL[plan.rationale.move] ?? plan.rationale.move;
    const outcome = log ? log.outcome : '-';
    const settle = log ? fmt(log.timeToSettleSeconds) : '-';
    const mark =
      outcome === 'settled' ? '✓' : outcome === 'stirred' ? '≈' : '✗';
    console.log(
      '  ' +
        [
          plan.date,
          move.padEnd(10),
          fmt(plan.targetSeconds).padStart(6),
          `${mark} ${outcome}`.padEnd(12),
          settle.padStart(6),
          fmt(plan.frontierSeconds).padStart(7),
          fmt(plan.rationale.ceilingSeconds).padStart(6),
          plan.chewRecommended ? 'chew' : '—',
        ].join('  '),
    );
  }

  // Weekly progress chart — the one number that matters.
  console.log('\n  Weekly view — longest calm absence:');
  const series = weeklySeries(r.logs);
  const peak = Math.max(1, ...series.map((p) => p.longestCalmAbsenceSeconds));
  for (const p of series) {
    const bars = Math.round((p.longestCalmAbsenceSeconds / peak) * 34);
    console.log(
      `  ${p.weekStart}  ${'█'.repeat(bars).padEnd(34)}  ${fmt(
        p.longestCalmAbsenceSeconds,
      ).padStart(6)}  (${p.sessions} sessions)`,
    );
  }
  console.log(
    `  Best calm absence reached: ${fmt(longestCalmAbsence(r.logs))}   ` +
      `Final status: ${r.finalStatus}`,
  );
}

function wrap(text: string, width: number, indent: string): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > width) {
      lines.push(line.trim());
      line = w;
    } else {
      line += ' ' + w;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines.join('\n' + indent);
}

// Run when invoked directly (npm run sim).
const invokedDirectly =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`;

if (invokedDirectly) {
  console.log(
    '\nRosie Bear Separation Coach — engine simulation (deterministic, seeded)\n',
  );
  printScenario(scenarioSteady());
  printScenario(scenarioRegression());
  printScenario(scenarioTriage());
  console.log('');
}
