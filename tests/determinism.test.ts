import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import { SeededRandom } from '../src/core/rng/SeededRandom';
import { createInitialGameState } from '../src/core/state/GameState';
import { applyNeedsDelta } from '../src/core/state/mutations';
import { advanceScheduledTime } from '../src/core/time/scheduler';

const runDeterministicSequence = (seed: number) => {
  let state = createInitialGameState(balance, seed);
  const rng = new SeededRandom(seed);

  const time = advanceScheduledTime(state.clock, 120, {
    gameDayBoundary: balance.time.gameDayBoundary,
    hardBoundaryTime: balance.barry.time,
    softCheckpointTimes: balance.time.eventCheckpoints,
  });

  state = { ...state, clock: time.clock };

  const energyDelta = -Math.round(rng.next() * 10);
  const mutated = applyNeedsDelta(
    state,
    { energy: energyDelta, happiness: -2 },
    { min: balance.needs.min, max: balance.needs.max },
  );

  return {
    ...mutated.state,
    rngState: rng.snapshot().state,
  };
};

describe('core determinism', () => {
  it('produces identical core state for the same seed and action sequence', () => {
    expect(runDeterministicSequence(123456)).toEqual(
      runDeterministicSequence(123456),
    );
  });

  it('changes deterministic state when the seed changes', () => {
    expect(runDeterministicSequence(1)).not.toEqual(
      runDeterministicSequence(2),
    );
  });
});
