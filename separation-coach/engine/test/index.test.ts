import { beforeEach, describe, expect, it } from 'vitest';
import {
  computeDailyPlan,
  daysSinceLast,
  longestCalmAbsence,
  weeklySeries,
} from '../src/index.js';
import { log, makeProfile, resetDates } from './helpers.js';

beforeEach(resetDates);

describe('daily plan assembly', () => {
  it('produces a complete active card for a healthy history', () => {
    const history = [log(60, 'settled', { cueResult: 'settled' })];
    const plan = computeDailyPlan(history, makeProfile(), '2026-01-06');
    expect(plan.status).toBe('active');
    expect(plan.targetSeconds).toBeGreaterThan(0);
    expect(plan.cueToWork).toBe('keys');
    expect(plan.cueStep).toBe(1);
    expect(plan.reentryInstruction).toMatch(/calm|low-key/i);
    expect(plan.referral).toBeNull();
  });
});

describe('chew — training wheels, faded as calm builds', () => {
  it('is recommended early (below the fade threshold)', () => {
    const plan = computeDailyPlan([log(60, 'settled')], makeProfile(), '2026-01-06');
    expect(plan.chewRecommended).toBe(true);
    expect(plan.chewNote).toMatch(/training wheels/i);
  });

  it('is faded once the dog holds long stretches with no recent distress', () => {
    // Frontier well above the 180s fade threshold, last rep clean-settled.
    const history = [log(200, 'settled'), log(220, 'settled')];
    const plan = computeDailyPlan(history, makeProfile(), '2026-02-01');
    expect(plan.frontierSeconds).toBeGreaterThan(180);
    expect(plan.chewRecommended).toBe(false);
    expect(plan.chewNote).toMatch(/fading/i);
  });

  it('comes back for a hard day even once faded', () => {
    // Frontier stays above the fade threshold even after the distress knock-down
    // (min(400,400)*0.5 = 200 > 180), so this is the genuine "faded, but hard
    // day" path rather than the early-days path.
    const history = [log(400, 'settled'), log(400, 'distressed')];
    const plan = computeDailyPlan(history, makeProfile(), '2026-02-01');
    expect(plan.frontierSeconds).toBeGreaterThan(180);
    expect(plan.chewRecommended).toBe(true);
    expect(plan.chewNote).toMatch(/hard one/i);
  });

  it('is never recommended when the owner opted out', () => {
    const plan = computeDailyPlan(
      [log(60, 'settled')],
      makeProfile({ useChew: false }),
      '2026-01-06',
    );
    expect(plan.chewRecommended).toBe(false);
  });
});

describe('weekly progress metric', () => {
  it('reports the all-time longest calm (settled) absence', () => {
    const history = [
      log(60, 'settled'),
      log(120, 'distressed'), // not counted — not settled
      log(90, 'settled'),
    ];
    expect(longestCalmAbsence(history)).toBe(90);
  });

  it('buckets settled reps by week', () => {
    resetDates();
    const history = [
      { ...log(60, 'settled'), date: '2026-01-05' }, // week of Jan 5
      { ...log(80, 'settled'), date: '2026-01-08' }, // same week
      { ...log(150, 'settled'), date: '2026-01-13' }, // next week
    ];
    const series = weeklySeries(history);
    expect(series).toHaveLength(2);
    expect(series[0]!.weekStart).toBe('2026-01-05');
    expect(series[0]!.longestCalmAbsenceSeconds).toBe(80);
    expect(series[1]!.longestCalmAbsenceSeconds).toBe(150);
  });
});

describe('daysSinceLast', () => {
  it('is null with no history', () => {
    expect(daysSinceLast([], '2026-01-05')).toBeNull();
  });
  it('counts whole days from the last session', () => {
    const history = [{ ...log(60, 'settled'), date: '2026-01-05' }];
    expect(daysSinceLast(history, '2026-01-10')).toBe(5);
  });
});
