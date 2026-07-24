import type { Outcome, Profile, SessionLog } from '../src/types.js';

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    baselineCalmSeconds: 120,
    firstDepartureCue: 'keys',
    hasCamera: false,
    homeSetup: 'House, free-roam',
    weeklyAvailability: 4,
    useChew: true,
    triageFlags: {
      selfInjury: false,
      exitPointDestruction: false,
      refusesFoodWhenAlone: false,
      eliminationDespiteHousetrained: false,
    },
    ...overrides,
  };
}

let dayCounter = 0;
/** Sequential ISO dates starting 2026-01-05 (a Monday), one day apart. */
export function nextDate(): string {
  const d = new Date(Date.parse('2026-01-05'));
  d.setUTCDate(d.getUTCDate() + dayCounter++);
  return d.toISOString().slice(0, 10);
}

export function resetDates(): void {
  dayCounter = 0;
}

export function log(
  targetSeconds: number,
  outcome: Outcome,
  overrides: Partial<SessionLog> = {},
): SessionLog {
  return {
    date: nextDate(),
    targetSeconds,
    outcome,
    // By default a settled rep settles quickly, so it counts as a clean climb
    // rather than being downgraded by the settled-but-slow guard.
    timeToSettleSeconds:
      outcome === 'settled'
        ? Math.round(targetSeconds * 0.3)
        : targetSeconds,
    chewUsed: false,
    ...overrides,
  };
}
