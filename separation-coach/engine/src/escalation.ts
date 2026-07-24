// ---------------------------------------------------------------------------
// Mid-program welfare escalation.
//
// The brief: three consecutive failures at the same duration → halt and refer.
// Because a distressed rep makes the engine DROP below the frontier, a run of
// distress spans DECREASING durations, not one fixed number. That downward
// spiral — the dog not coping even as we back off — is the real welfare signal,
// so the trigger is `consecutiveDistressLimit` distressed reps in a row.
// Plateauing on `stirred` is handled by the progression's hold rule, not here;
// it is not a welfare stop.
// ---------------------------------------------------------------------------

import type { EngineConfig } from './config.js';
import type { Referral, SessionLog } from './types.js';

/** Count of trailing reps whose outcome is 'distressed', newest-first. */
export function trailingDistressStreak(
  history: ReadonlyArray<SessionLog>,
): number {
  let n = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]!.outcome === 'distressed') n++;
    else break;
  }
  return n;
}

const HALT_MESSAGE =
  "We're going to pause here. The last few sessions have been hard for her " +
  "even as we've shortened things, and that's a sign this is bigger than a " +
  "schedule can carry on its own. It's worth talking to a vet or a veterinary " +
  "behaviourist now — not as a setback, but as the right next step. Nothing " +
  "you've logged is lost; you can pick this back up alongside their guidance.";

export function assessEscalation(
  history: ReadonlyArray<SessionLog>,
  config: EngineConfig,
): Referral | null {
  if (trailingDistressStreak(history) >= config.consecutiveDistressLimit) {
    return {
      kind: 'refer',
      reason: 'escalation-consecutive-distress',
      message: HALT_MESSAGE,
    };
  }
  return null;
}
