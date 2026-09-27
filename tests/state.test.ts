import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import { creditCash, debitCash } from '../src/core/economy/money';
import { createInitialGameState } from '../src/core/state/GameState';
import { applyNeedsDelta } from '../src/core/state/mutations';

describe('core state invariants', () => {
  it('keeps money in integer rubles', () => {
    expect(creditCash(500, 10.6)).toBe(511);
    expect(debitCash(500.4, 100.6)).toBe(399);
  });

  it('clamps needs and emits HEALTH_ZERO only once', () => {
    const initial = createInitialGameState(balance, 1);
    const first = applyNeedsDelta(
      initial,
      { health: -500, energy: -500, happiness: 500 },
      { min: balance.needs.min, max: balance.needs.max },
    );

    expect(first.state.needs.health).toBe(0);
    expect(first.state.needs.energy).toBe(0);
    expect(first.state.needs.happiness).toBe(100);
    expect(first.terminalTransition).toBe('HEALTH_ZERO');

    const second = applyNeedsDelta(
      first.state,
      { health: -1 },
      { min: balance.needs.min, max: balance.needs.max },
    );
    expect(second.terminalTransition).toBeNull();
  });
});
