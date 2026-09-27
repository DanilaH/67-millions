import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import {
  beginBarryInterrupt,
  getBarryPayment,
  resolveBarryPayment,
} from '../src/core/barry/barry';
import { canPayMainDebt, payMainDebt } from '../src/core/economy/mainDebt';
import { createInitialGameState } from '../src/core/state/GameState';

describe('Barry and principal', () => {
  it('uses the configured ladder and exponential continuation', () => {
    expect(getBarryPayment(balance, 0)).toBe(3000);
    expect(getBarryPayment(balance, balance.barry.payments.length)).toBe(124800000);
  });

  it('does not reduce principal when Barry is paid', () => {
    let state = createInitialGameState(balance, 1);
    state = { ...state, cash: 5000 };
    state = beginBarryInterrupt(state);
    state = resolveBarryPayment(state, balance);

    expect(state.cash).toBe(2000);
    expect(state.mainDebt).toBe(67000000);
    expect(state.barryPaymentIndex).toBe(1);
    expect(state.totalBarryPaid).toBe(3000);
    expect(state.barryInterruptPending).toBe(false);
  });

  it('fails the run when Barry cannot be paid', () => {
    let state = createInitialGameState(balance, 1);
    state = beginBarryInterrupt(state);
    state = resolveBarryPayment(state, balance);

    expect(state.terminalReason).toBe('BARRY_PAYMENT_FAILED');
  });

  it('never auto-wins at 67m and only wins after explicit full payment', () => {
    let state = { ...createInitialGameState(balance, 1), cash: 67000000 };
    expect(state.victory).toBe(false);
    expect(canPayMainDebt(state)).toBe(true);

    state = payMainDebt(state);
    expect(state.victory).toBe(true);
    expect(state.mainDebt).toBe(0);
    expect(state.cash).toBe(0);
  });
});
