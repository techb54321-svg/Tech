// ---------------------------------------------------------------------------
// Cue-decoupling track.
//
// Runs in parallel with, and independently of, the duration track. The goal is
// to break the chain "cue → I leave" so the cue stops predicting departure.
// The dog advances a small ladder: each rung is performed WITHOUT actually
// leaving, repeated until the cue draws no reaction, then the next rung layers
// the next link of the departure routine on top.
//
// Progress is driven only by the `cueResult` field of logged sessions, so the
// two tracks never interfere.
// ---------------------------------------------------------------------------

import type { DepartureCue, SessionLog } from './types.js';

/**
 * Ladder templates keyed by the position of the trigger cue. `{cue}` is filled
 * with the dog's own first cue. The final rung is "mastered".
 */
const LADDER: ReadonlyArray<(cue: string) => string> = [
  (cue) =>
    `Pick up your ${cue}, then sit back down. Don't leave. Repeat a few times, ` +
    `until picking them up stops getting a reaction.`,
  (cue) =>
    `Handle your ${cue} and then do something ordinary — fill the kettle, ` +
    `check your phone. Stay home. You're teaching her the ${cue} means nothing.`,
  (cue) =>
    `Pick up your ${cue} and walk to the door. Touch the handle, then turn ` +
    `around and sit back down. No leaving yet.`,
  (cue) =>
    `${cap(cue)} in hand, open the door, step out for two seconds, step back ` +
    `in. No fuss, no big hello. Repeat until it's boring.`,
];

const MASTERED =
  "The departure cue barely registers now — she's stopped reading it as 'you're " +
  "leaving.' Keep it woven into normal days so it stays that way.";

function cap(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

/** Human label for a cue (kept simple; `other` falls back to a neutral word). */
export function cueWord(cue: DepartureCue): string {
  return cue === 'other' ? 'departure routine' : cue;
}

export interface CueState {
  step: number;
  mastered: boolean;
  instruction: string;
}

/**
 * Current rung, derived by replaying `cueResult`s: a settled cue rep advances
 * one rung, a stirred rep holds, a distressed rep steps back one rung. The
 * ladder never advances past mastery.
 */
export function computeCueState(
  history: ReadonlyArray<SessionLog>,
  cue: DepartureCue,
): CueState {
  let step = 0;
  for (const s of history) {
    if (s.cueResult === undefined) continue;
    if (s.cueResult === 'settled') step += 1;
    else if (s.cueResult === 'distressed') step = Math.max(0, step - 1);
    // 'stirred' holds.
  }

  const mastered = step >= LADDER.length;
  const word = cueWord(cue);
  const instruction = mastered ? MASTERED : LADDER[step]!(word);

  return { step, mastered, instruction };
}
