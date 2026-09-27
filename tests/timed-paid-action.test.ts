import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import {
  applyTimedPaidCompletion,
  startTimedPaidAction,
} from '../src/core/actions/timedPaidAction';
import { createInitialGameState } from '../src/core/state/GameState';

describe('timed paid action transaction', () => {
  const definition = {
    id: 'TEST_FOOD',
    price: 150,
    durationMinutes: 45,
    completionNeedsDelta: { satiety: 30 },
  };

  it('debits cash at start and grants effect only on completion', () => {
    const initial = {
      ...createInitialGameState(balance, 1),
      needs: { health: 100, satiety: 50, energy: 100, happiness: 100 },
    };

    const started = startTimedPaidAction(initial, definition);
    expect(started.state.cash).toBe(350);
    expect(started.state.needs.satiety).toBe(50);
    expect(started.action.upfrontApplied).toBe(true);

    const completed = applyTimedPaidCompletion(started.state, definition, balance);
    expect(completed.cash).toBe(350);
    expect(completed.needs.satiety).toBe(80);
  });

  it('does not grant completion effect after terminal failure', () => {
    const initial = {
      ...createInitialGameState(balance, 1),
      terminalReason: 'BARRY_PAYMENT_FAILED' as const,
      needs: { health: 100, satiety: 50, energy: 100, happiness: 100 },
    };

    const completed = applyTimedPaidCompletion(initial, definition, balance);
    expect(completed.needs.satiety).toBe(50);
  });
});
