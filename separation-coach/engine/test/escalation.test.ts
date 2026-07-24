import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/config.js';
import { assessEscalation, trailingDistressStreak } from '../src/escalation.js';
import { computeDailyPlan } from '../src/index.js';
import { log, makeProfile, resetDates } from './helpers.js';

beforeEach(resetDates);

describe('mid-program escalation', () => {
  it('does not escalate below the consecutive-distress limit', () => {
    const history = [
      log(120, 'settled'),
      log(60, 'distressed'),
      log(30, 'distressed'),
    ];
    expect(trailingDistressStreak(history)).toBe(2);
    expect(assessEscalation(history, DEFAULT_CONFIG)).toBeNull();
  });

  it('escalates on three consecutive distressed reps', () => {
    const history = [
      log(120, 'settled'),
      log(60, 'distressed'),
      log(30, 'distressed'),
      log(15, 'distressed'),
    ];
    expect(trailingDistressStreak(history)).toBe(3);
    const referral = assessEscalation(history, DEFAULT_CONFIG);
    expect(referral?.reason).toBe('escalation-consecutive-distress');
  });

  it('a settled rep in between resets the streak', () => {
    const history = [
      log(60, 'distressed'),
      log(30, 'distressed'),
      log(20, 'settled'),
      log(25, 'distressed'),
    ];
    expect(trailingDistressStreak(history)).toBe(1);
    expect(assessEscalation(history, DEFAULT_CONFIG)).toBeNull();
  });

  it('a halted plan prescribes no rep and surfaces the referral', () => {
    const history = [
      log(120, 'settled'),
      log(60, 'distressed'),
      log(30, 'distressed'),
      log(15, 'distressed'),
    ];
    const plan = computeDailyPlan(history, makeProfile(), '2026-02-01');
    expect(plan.status).toBe('halted');
    expect(plan.targetSeconds).toBe(0);
    expect(plan.referral?.reason).toBe('escalation-consecutive-distress');
  });
});
