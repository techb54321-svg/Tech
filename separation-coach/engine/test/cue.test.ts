import { beforeEach, describe, expect, it } from 'vitest';
import { computeCueState } from '../src/cue.js';
import { log, resetDates } from './helpers.js';

beforeEach(resetDates);

describe('cue-decoupling track', () => {
  it('starts at step 0 with a keys-specific instruction', () => {
    const state = computeCueState([], 'keys');
    expect(state.step).toBe(0);
    expect(state.mastered).toBe(false);
    expect(state.instruction).toMatch(/keys/);
  });

  it('advances one rung per settled cue rep', () => {
    const history = [
      log(60, 'settled', { cueResult: 'settled' }),
      log(66, 'settled', { cueResult: 'settled' }),
    ];
    expect(computeCueState(history, 'keys').step).toBe(2);
  });

  it('holds on a stirred cue rep', () => {
    const history = [
      log(60, 'settled', { cueResult: 'settled' }),
      log(66, 'settled', { cueResult: 'stirred' }),
    ];
    expect(computeCueState(history, 'keys').step).toBe(1);
  });

  it('steps back on a distressed cue rep but never below zero', () => {
    const history = [
      log(60, 'settled', { cueResult: 'distressed' }),
      log(66, 'settled', { cueResult: 'distressed' }),
    ];
    expect(computeCueState(history, 'keys').step).toBe(0);
  });

  it('runs independently of the duration outcome', () => {
    // Duration distressed, but the cue rep went fine — cue still advances.
    const history = [log(60, 'distressed', { cueResult: 'settled' })];
    expect(computeCueState(history, 'shoes').step).toBe(1);
  });

  it('reaches mastery after clearing the ladder', () => {
    const history = Array.from({ length: 6 }, () =>
      log(60, 'settled', { cueResult: 'settled' }),
    );
    const state = computeCueState(history, 'bag');
    expect(state.mastered).toBe(true);
    expect(state.instruction).toMatch(/barely registers/i);
  });
});
