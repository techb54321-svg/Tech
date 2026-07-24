import { describe, expect, it } from 'vitest';
import { assessTriage } from '../src/triage.js';
import { computeDailyPlan } from '../src/index.js';
import { makeProfile } from './helpers.js';

describe('intake triage gate', () => {
  it('enrols a dog with no red flags', () => {
    const result = assessTriage(makeProfile());
    expect(result.enrol).toBe(true);
    expect(result.referral).toBeNull();
  });

  const flags = [
    ['selfInjury', 'triage-selfInjury'],
    ['exitPointDestruction', 'triage-exitPointDestruction'],
    ['refusesFoodWhenAlone', 'triage-refusesFoodWhenAlone'],
    ['eliminationDespiteHousetrained', 'triage-eliminationDespiteHousetrained'],
  ] as const;

  for (const [flag, reason] of flags) {
    it(`does NOT enrol on ${flag}`, () => {
      const profile = makeProfile({
        triageFlags: {
          selfInjury: false,
          exitPointDestruction: false,
          refusesFoodWhenAlone: false,
          eliminationDespiteHousetrained: false,
          [flag]: true,
        },
      });
      const result = assessTriage(profile);
      expect(result.enrol).toBe(false);
      expect(result.referral?.reason).toBe(reason);
      expect(result.referral?.message).toMatch(/vet|behaviourist/i);
    });
  }

  it('a red flag blocks the daily plan entirely — no rep prescribed', () => {
    const profile = makeProfile({
      triageFlags: {
        selfInjury: true,
        exitPointDestruction: false,
        refusesFoodWhenAlone: false,
        eliminationDespiteHousetrained: false,
      },
    });
    const plan = computeDailyPlan([], profile, '2026-01-05');
    expect(plan.status).toBe('refer');
    expect(plan.targetSeconds).toBe(0);
    expect(plan.referral).not.toBeNull();
  });
});
