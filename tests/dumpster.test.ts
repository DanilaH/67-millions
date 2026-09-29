import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import {
  getDumpsterEmptyChance,
  settleDumpsterSearch,
  startDumpsterSearch,
} from '../src/core/actions/dumpster';
import { commitBareDrop } from '../src/core/plinko-rules/drop';
import { SeededRandom } from '../src/core/rng/SeededRandom';
import { startSleep } from '../src/core/sleep/sleep';
import { createInitialGameState } from '../src/core/state/GameState';
import { createGameClock } from '../src/core/time/GameClock';
import { advanceRunTime } from '../src/core/time/runTime';

const findSeed = (
  predicate: (first: number, second: number) => boolean,
): number => {
  for (let seed = 1; seed < 100_000; seed += 1) {
    const rng = new SeededRandom(seed);
    const first = rng.next();
    const second = rng.next();
    if (predicate(first, second)) return seed;
  }
  throw new Error('Unable to find deterministic test seed');
};

describe('dumpster recovery', () => {
  it('is available at zero cash/Energy/Happiness and overflows cost into HP', () => {
    const state = {
      ...createInitialGameState(balance, 1),
      cash: 0,
      needs: {
        health: 100,
        satiety: 50,
        energy: 0,
        happiness: 0,
      },
    };

    const started = startDumpsterSearch(state, null, null, balance);

    expect(started.state.cash).toBe(0);
    expect(started.state.needs.energy).toBe(0);
    expect(started.state.needs.happiness).toBe(0);
    expect(started.state.needs.health).toBeCloseTo(92.5);
    expect(started.energySpent).toBe(0);
    expect(started.happinessSpent).toBe(0);
    expect(started.healthSpent).toBeCloseTo(7.5);
    expect(started.action.remainingMinutes).toBe(45);
    expect(started.state.dumpsterSearchStreak).toBe(0);
  });

  it('uses Energy first, then Happiness, then HP for the upfront cost', () => {
    const state = {
      ...createInitialGameState(balance, 1),
      needs: {
        health: 100,
        satiety: 50,
        energy: 10,
        happiness: 3,
      },
    };

    const started = startDumpsterSearch(state, null, null, balance);

    expect(started.energySpent).toBe(10);
    expect(started.happinessSpent).toBe(3);
    expect(started.healthSpent).toBeCloseTo(2.25);
    expect(started.state.needs).toEqual({
      health: 97.75,
      satiety: 50,
      energy: 0,
      happiness: 0,
    });
  });

  it('can kill the run at start cost and then grants no loot', () => {
    const state = {
      ...createInitialGameState(balance, 1),
      cash: 0,
      rngState: 12345,
      needs: {
        health: 5,
        satiety: 0,
        energy: 0,
        happiness: 0,
      },
    };

    const started = startDumpsterSearch(state, null, null, balance);
    expect(started.state.terminalReason).toBe('HEALTH_ZERO');

    const resolved = settleDumpsterSearch(started.state, balance);
    expect(resolved.loot).toBe('TERMINAL_NO_LOOT');
    expect(resolved.state.cash).toBe(0);
    expect(resolved.state.rngState).toBe(12345);
    expect(resolved.state.dumpsterSearchStreak).toBe(0);
  });

  it('uses the configured escalating empty chance and caps later searches', () => {
    expect(getDumpsterEmptyChance(balance, 0)).toBe(0.55);
    expect(getDumpsterEmptyChance(balance, 1)).toBe(0.62);
    expect(getDumpsterEmptyChance(balance, 2)).toBe(0.7);
    expect(getDumpsterEmptyChance(balance, 3)).toBe(0.78);
    expect(getDumpsterEmptyChance(balance, 100)).toBe(0.78);
  });

  it('rolls empty first and consumes no category RNG when empty', () => {
    const seed = findSeed((first) => first < 0.55);
    const expectedRng = new SeededRandom(seed);
    expectedRng.next();

    const state = {
      ...createInitialGameState(balance, seed),
      cash: 0,
      rngState: seed,
    };
    const resolved = settleDumpsterSearch(state, balance);

    expect(resolved.loot).toBe('EMPTY');
    expect(resolved.cashAward).toBe(0);
    expect(resolved.state.rngState).toBe(expectedRng.snapshot().state);
    expect(resolved.state.dumpsterSearchStreak).toBe(1);
  });

  it('normalizes non-empty category weights after the empty roll', () => {
    const weights = [
      ['CHEAP_FOOD', 25],
      ['CASH', 12],
      ['SELLABLE_OBJECT', 6],
      ['RARE_FIND', 2],
    ] as const;
    const totalWeight = weights.reduce((sum, [, weight]) => sum + weight, 0);

    const seed = findSeed((first) => first >= 0.55);
    const expectedRng = new SeededRandom(seed);
    const emptyRoll = expectedRng.next();
    expect(emptyRoll).toBeGreaterThanOrEqual(0.55);
    let weightedRoll = expectedRng.next() * totalWeight;
    const expected =
      weights.find(([, weight]) => {
        weightedRoll -= weight;
        return weightedRoll < 0;
      })?.[0] ?? 'RARE_FIND';

    const state = {
      ...createInitialGameState(balance, seed),
      cash: 0,
      rngState: seed,
    };
    const resolved = settleDumpsterSearch(state, balance);

    expect(resolved.loot).toBe(expected);
    expect(resolved.loot).not.toBe('EMPTY');
    expect(resolved.state.dumpsterSearchStreak).toBe(1);
  });

  it('applies cheap-food loot immediately with no inventory step', () => {
    const cheapWeight = 25 / (25 + 12 + 6 + 2);
    const seed = findSeed(
      (first, second) => first >= 0.55 && second < cheapWeight,
    );
    const state = {
      ...createInitialGameState(balance, seed),
      cash: 0,
      rngState: seed,
      needs: {
        health: 100,
        satiety: 20,
        energy: 50,
        happiness: 50,
      },
    };

    const resolved = settleDumpsterSearch(state, balance);

    expect(resolved.loot).toBe('CHEAP_FOOD');
    expect(resolved.cashAward).toBe(0);
    expect(resolved.state.needs.satiety).toBe(50);
    expect(resolved.state.needs.happiness).toBe(48);
  });

  it('is deterministic from serialized RNG state', () => {
    const state = {
      ...createInitialGameState(balance, 424242),
      cash: 0,
      rngState: 424242,
    };

    const a = settleDumpsterSearch(state, balance);
    const b = settleDumpsterSearch(state, balance);

    expect(a).toEqual(b);
  });

  it('charges at start, advances 45 minutes, then rolls loot at completion', () => {
    const state = {
      ...createInitialGameState(balance, 123),
      clock: createGameClock('10:00'),
      rngState: 123,
      needs: {
        health: 100,
        satiety: 50,
        energy: 100,
        happiness: 100,
      },
    };
    const started = startDumpsterSearch(state, null, null, balance);

    expect(started.state.needs.energy).toBe(80);
    expect(started.state.rngState).toBe(123);
    expect(started.state.dumpsterSearchStreak).toBe(0);

    const advanced = advanceRunTime(
      started.state,
      started.action,
      started.action.remainingMinutes,
      balance,
    );

    expect(advanced.advancedMinutes).toBe(45);
    expect(advanced.actionCompleted).toBe(true);
    expect(advanced.activeAction).toBeNull();
    expect(advanced.state.clock.minuteOfDay).toBe(
      createGameClock('10:45').minuteOfDay,
    );
    expect(advanced.state.rngState).toBe(123);
    expect(advanced.state.dumpsterSearchStreak).toBe(0);

    const resolved = settleDumpsterSearch(advanced.state, balance);
    expect(resolved.state.dumpsterSearchStreak).toBe(1);
    expect(resolved.state.rngState).not.toBe(123);
  });

  it('resets the spam streak at the 09:00 game-day boundary', () => {
    const state = {
      ...createInitialGameState(balance, 1),
      cash: 5_000,
      clock: createGameClock('08:50'),
      dumpsterSearchStreak: 3,
    };

    const advanced = advanceRunTime(state, null, 20, balance);

    expect(advanced.state.barryInterruptPending).toBe(true);
    expect(advanced.state.dumpsterSearchStreak).toBe(0);
  });

  it('resets the spam streak after a completed sleep', () => {
    const state = {
      ...createInitialGameState(balance, 1),
      clock: createGameClock('10:00'),
      dumpsterSearchStreak: 3,
    };
    const sleep = startSleep(state, balance);

    const advanced = advanceRunTime(
      state,
      sleep,
      sleep.remainingMinutes,
      balance,
    );

    expect(advanced.actionCompleted).toBe(true);
    expect(advanced.state.dumpsterSearchStreak).toBe(0);
  });

  it('locks starts during another action or pending Drop', () => {
    const state = {
      ...createInitialGameState(balance, 1),
      cash: 10_000,
    };
    const first = startDumpsterSearch(state, null, null, balance);

    expect(() =>
      startDumpsterSearch(first.state, first.action, null, balance),
    ).toThrow('another action is active');

    const committed = commitBareDrop(
      state,
      null,
      balance,
      'dumpster-lock',
      1,
    );
    expect(() =>
      startDumpsterSearch(
        committed.state,
        null,
        committed.pendingDrop,
        balance,
      ),
    ).toThrow('Drop is pending');
  });
});
