import { describe, expect, it } from 'vitest';
import {
  scenarioRegression,
  scenarioSteady,
  scenarioTriage,
} from '../sim/simulate.js';

describe('6-week simulation traces', () => {
  it('steady scenario: progresses and never breaches the ceiling', () => {
    const r = scenarioSteady();
    expect(r.finalStatus).toBe('active');

    // No plan ever prescribes above its own reported ceiling.
    for (const p of r.plans) {
      if (p.status === 'active') {
        expect(p.targetSeconds).toBeLessThanOrEqual(p.rationale.ceilingSeconds);
      }
    }

    // The full range of behaviours shows up over six weeks.
    const moves = new Set(
      r.plans.filter((p) => p.status === 'active').map((p) => p.rationale.move),
    );
    expect(moves).toContain('first');
    expect(moves).toContain('climb');
    expect(moves).toContain('short-rep');
    expect(moves).toContain('re-warm');
    expect(moves).toContain('drop'); // the one transient bad day
    expect(moves).toContain('hold');

    // It does NOT escalate: a single bad day is not a welfare stop.
    expect(r.plans.some((p) => p.status === 'halted')).toBe(false);

    // Real progress: the dog ends up holding far longer than the start rung.
    const best = Math.max(
      ...r.logs.filter((l) => l.outcome === 'settled').map((l) => l.targetSeconds),
    );
    expect(best).toBeGreaterThan(120); // beyond the self-reported baseline
  });

  it('regression scenario: halts on the third consecutive distress and refers', () => {
    const r = scenarioRegression();
    expect(r.finalStatus).toBe('halted');

    const halted = r.plans.find((p) => p.status === 'halted');
    expect(halted?.referral?.reason).toBe('escalation-consecutive-distress');

    // Exactly the three failing reps were logged before the halt.
    const trailingDistress = (() => {
      let n = 0;
      for (let i = r.logs.length - 1; i >= 0; i--) {
        if (r.logs[i]!.outcome === 'distressed') n++;
        else break;
      }
      return n;
    })();
    expect(trailingDistress).toBe(3);

    // Even mid-collapse, no prescribed target breached its ceiling.
    for (const p of r.plans) {
      if (p.status === 'active') {
        expect(p.targetSeconds).toBeLessThanOrEqual(p.rationale.ceilingSeconds);
      }
    }

    // The drops are strictly decreasing — the engine backs off, it never pushes.
    const distressTargets = r.logs
      .filter((l) => l.outcome === 'distressed')
      .map((l) => l.targetSeconds);
    for (let i = 1; i < distressTargets.length; i++) {
      expect(distressTargets[i]!).toBeLessThan(distressTargets[i - 1]!);
    }
  });

  it('triage scenario: never enrols, prescribes nothing', () => {
    const r = scenarioTriage();
    expect(r.finalStatus).toBe('refer');
    expect(r.logs.length).toBe(0);
    expect(r.plans[0]?.referral?.reason).toBe('triage-exitPointDestruction');
  });
});
