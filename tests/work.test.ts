import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import { createInitialGameState } from '../src/core/state/GameState';
import {
  setWorkResult,
  settleWork,
  startWork,
} from '../src/core/work/work';
import { createGameClock } from '../src/core/time/GameClock';

describe('work transaction', () => {
  it('checks the start window only and reserves state cost at start', () => {
    const state = {
      ...createInitialGameState(balance, 1),
      clock: createGameClock('23:50'),
    };
    const started = startWork(state, balance, 'dishes', 1);

    expect(started.state.needs.energy).toBe(88);
    expect(started.state.needs.happiness).toBe(97);
    expect(started.action.remainingMinutes).toBe(120);
  });

  it('rejects work below the required Energy cost', () => {
    const state = {
      ...createInitialGameState(balance, 1),
      clock: createGameClock('16:00'),
      needs: { health: 100, satiety: 100, energy: 11, happiness: 100 },
    };
    expect(() => startWork(state, balance, 'dishes', 1)).toThrow('Not enough Energy');
  });

  it('settles salary only after a stored success result and applies sleep modifier', () => {
    const state = {
      ...createInitialGameState(balance, 1),
      clock: createGameClock('16:00'),
      workPayoutMultiplier: 0.85,
    };
    const started = startWork(state, balance, 'dishes', 1);
    const action = setWorkResult(started.action, 'SUCCESS');
    const settled = settleWork(started.state, action, balance);

    expect(settled.cash).toBe(500 + 2550);
  });
});
