import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, type EngineConfig } from '../src/config.js';
import {
  computeDurationTarget,
  frontier,
  startRung,
} from '../src/progression.js';
import { mulberry32 } from '../src/rng.js';
import type { Outcome, SessionLog } from '../src/types.js';
import { log, makeProfile, resetDates } from './helpers.js';

beforeEach(resetDates);

const cfg = DEFAULT_CONFIG;

describe('starting rung — always err short', () => {
  it('first rep is well under the untested self-reported baseline', () => {
    const profile = makeProfile({ baselineCalmSeconds: 120 });
    const d = computeDurationTarget([], profile, cfg, null);
    expect(d.move).toBe('first');
    expect(d.targetSeconds).toBe(60); // 120 * 0.5
    expect(d.targetSeconds).toBeLessThan(profile.baselineCalmSeconds);
  });

  it('never goes below the configured floor', () => {
    const profile = makeProfile({ baselineCalmSeconds: 2 });
    const d = computeDurationTarget([], profile, cfg, null);
    expect(d.targetSeconds).toBeGreaterThanOrEqual(cfg.minTargetSeconds);
  });
});

describe('determinism', () => {
  it('same inputs → identical output (no clock, no Math.random)', () => {
    const profile = makeProfile();
    const history = [log(60, 'settled'), log(70, 'settled')];
    const a = computeDurationTarget(history, profile, cfg, 1);
    resetDates();
    const b = computeDurationTarget(history, profile, cfg, 1);
    expect(a).toEqual(b);
  });
});

describe('climb (settled)', () => {
  it('increments above the frontier but within the ceiling', () => {
    const profile = makeProfile();
    const history = [log(100, 'settled')];
    // Force a climb (no short reps) for a clean assertion.
    const climbCfg: EngineConfig = { ...cfg, shortRepProb: 0 };
    const d = computeDurationTarget(history, profile, climbCfg, 1);
    expect(d.move).toBe('climb');
    expect(d.targetSeconds).toBeGreaterThan(100);
    expect(d.targetSeconds).toBeLessThanOrEqual(d.ceilingSeconds);
  });

  it('lower weekly availability → smaller increment', () => {
    const history = [log(100, 'settled')];
    const climbCfg: EngineConfig = { ...cfg, shortRepProb: 0 };
    const low = computeDurationTarget(
      history,
      makeProfile({ weeklyAvailability: 1 }),
      climbCfg,
      1,
      42,
    );
    resetDates();
    const high = computeDurationTarget(
      history,
      makeProfile({ weeklyAvailability: 5 }),
      climbCfg,
      1,
      42,
    );
    expect(low.move).toBe('climb');
    expect(high.move).toBe('climb');
    expect(low.targetSeconds).toBeLessThan(high.targetSeconds);
  });
});

describe('short reps — non-monotonic by design', () => {
  it('some seeds schedule a deliberately shorter rep after a longer one', () => {
    const profile = makeProfile();
    const history = [log(100, 'settled')];
    const moves = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const d = computeDurationTarget(history, profile, cfg, 1, seed);
      moves.add(d.move);
      if (d.move === 'short-rep') {
        expect(d.targetSeconds).toBeLessThan(d.frontierSeconds);
      }
    }
    // Over many seeds we see both a climb and a shorter rep.
    expect(moves.has('climb')).toBe(true);
    expect(moves.has('short-rep')).toBe(true);
  });

  it('never schedules two short reps in a row', () => {
    const profile = makeProfile();
    // Last rep is already a short rep (well below the frontier).
    const history = [log(100, 'settled'), log(45, 'settled')];
    for (let seed = 0; seed < 100; seed++) {
      const d = computeDurationTarget(history, profile, cfg, 1, seed);
      expect(d.move).not.toBe('short-rep');
    }
  });
});

describe('stirred / settled-but-slow → hold', () => {
  it('repeats the same target on a stirred rep', () => {
    const d = computeDurationTarget(
      [log(90, 'settled'), log(99, 'stirred')],
      makeProfile(),
      cfg,
      1,
    );
    expect(d.move).toBe('hold');
    expect(d.targetSeconds).toBe(99);
  });

  it('a settled-but-slow rep holds rather than climbs', () => {
    const history: SessionLog[] = [
      log(90, 'settled'),
      // settled, but took longer than the absence itself to settle
      log(100, 'settled', { timeToSettleSeconds: 140 }),
    ];
    const d = computeDurationTarget(history, makeProfile(), cfg, 1);
    expect(d.move).toBe('hold');
    expect(d.targetSeconds).toBe(100);
  });
});

describe('distress → drop and adaptive frontier', () => {
  it('drops below the duration that failed', () => {
    const history = [log(100, 'settled'), log(120, 'distressed')];
    const d = computeDurationTarget(history, makeProfile(), cfg, 1);
    expect(d.move).toBe('drop');
    expect(d.targetSeconds).toBeLessThan(120);
  });

  it('a distressed rep knocks the working frontier down', () => {
    const profile = makeProfile();
    const before = frontier([log(200, 'settled')], profile, cfg);
    const after = frontier(
      [log(200, 'settled'), log(200, 'distressed')],
      profile,
      cfg,
    );
    expect(after).toBeLessThan(before);
    expect(after).toBe(100); // min(200,200) * 0.5
  });

  it('rebuilds gradually — never leaps back to the level that just failed', () => {
    const profile = makeProfile();
    // Climbed to 200, failed at 200, then settled at the dropped level.
    const history: SessionLog[] = [
      log(200, 'settled'),
      log(200, 'distressed'),
      log(100, 'settled'),
    ];
    const climbCfg: EngineConfig = { ...cfg, shortRepProb: 0 };
    const d = computeDurationTarget(history, profile, climbCfg, 1);
    expect(d.move).toBe('climb');
    // Climbs from the knocked-down frontier (100), not back to 200.
    expect(d.targetSeconds).toBeLessThanOrEqual(125);
    expect(d.targetSeconds).toBeGreaterThan(100);
  });
});

describe('missed days → graceful re-warm', () => {
  it('a gap prescribes a gentle rep below the frontier', () => {
    const history = [log(100, 'settled'), log(110, 'settled')];
    const d = computeDurationTarget(history, makeProfile(), cfg, 5);
    expect(d.move).toBe('re-warm');
    expect(d.targetSeconds).toBeLessThan(d.frontierSeconds);
    expect(d.targetSeconds).toBe(Math.floor(d.frontierSeconds * cfg.reWarmFactor));
  });

  it('a small gap does not trigger a re-warm', () => {
    const history = [log(100, 'settled')];
    const d = computeDurationTarget(history, makeProfile(), cfg, 1);
    expect(d.move).not.toBe('re-warm');
  });
});

// ---------------------------------------------------------------------------
// THE HARD INVARIANT.
// Overshooting sensitises the dog. Prove that across a large space of inputs —
// both adversarial hand-built histories and histories the engine drives itself
// — the target NEVER exceeds frontier * ceilingFactor, and never goes below the
// floor.
// ---------------------------------------------------------------------------

describe('INVARIANT: target never jumps beyond the ceiling', () => {
  const OUTCOMES: Outcome[] = ['settled', 'stirred', 'distressed'];

  function assertWithinCeiling(
    history: SessionLog[],
    baseline: number,
    gap: number | null,
    seed: number,
  ): void {
    const profile = makeProfile({ baselineCalmSeconds: baseline });
    const d = computeDurationTarget(history, profile, cfg, gap, seed);
    const ceiling = Math.floor(frontier(history, profile, cfg) * cfg.ceilingFactor);
    expect(d.targetSeconds).toBeLessThanOrEqual(ceiling);
    expect(d.ceilingSeconds).toBe(ceiling);
    expect(d.targetSeconds).toBeGreaterThanOrEqual(cfg.minTargetSeconds);
  }

  it('holds for 5000 adversarial random histories', () => {
    const rand = mulberry32(0xdecafbad);
    for (let i = 0; i < 5000; i++) {
      const n = Math.floor(rand() * 12);
      const history: SessionLog[] = [];
      for (let j = 0; j < n; j++) {
        // Deliberately arbitrary targets, including absurd ones.
        const target = Math.max(1, Math.floor(rand() * 5000));
        const outcome = OUTCOMES[Math.floor(rand() * 3)]!;
        history.push(log(target, outcome, { timeToSettleSeconds: Math.floor(rand() * 6000) }));
      }
      const baseline = 5 + Math.floor(rand() * 3600);
      const gap = rand() < 0.3 ? Math.floor(rand() * 14) : null;
      assertWithinCeiling(history, baseline, gap, Math.floor(rand() * 1e9));
      resetDates();
    }
  });

  it('holds at every step while the engine drives a random dog for 300 runs', () => {
    const rand = mulberry32(0x5eed);
    for (let run = 0; run < 300; run++) {
      const profile = makeProfile({
        baselineCalmSeconds: 30 + Math.floor(rand() * 600),
        weeklyAvailability: 1 + Math.floor(rand() * 7),
      });
      const history: SessionLog[] = [];
      for (let step = 0; step < 40; step++) {
        const gap = rand() < 0.15 ? cfg.reWarmGapDays + 1 : 1;
        const d = computeDurationTarget(
          history,
          profile,
          cfg,
          history.length ? gap : null,
          Math.floor(rand() * 1e9),
        );
        const ceiling = Math.floor(
          frontier(history, profile, cfg) * cfg.ceilingFactor,
        );
        expect(d.targetSeconds).toBeLessThanOrEqual(ceiling);
        // Feed a random outcome back in and continue.
        const outcome = OUTCOMES[Math.floor(rand() * 3)]!;
        history.push(
          log(d.targetSeconds, outcome, {
            timeToSettleSeconds: Math.floor(rand() * d.targetSeconds * 1.5),
          }),
        );
      }
      resetDates();
    }
  });
});

describe('frontier basics', () => {
  it('before any settled rep, equals the conservative start rung', () => {
    const profile = makeProfile({ baselineCalmSeconds: 100 });
    expect(frontier([], profile, cfg)).toBe(startRung(profile, cfg));
    expect(frontier([], profile, cfg)).toBe(50);
  });

  it('tracks the highest settled duration', () => {
    const profile = makeProfile();
    const history = [log(60, 'settled'), log(80, 'settled'), log(40, 'settled')];
    expect(frontier(history, profile, cfg)).toBe(80);
  });
});
