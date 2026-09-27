import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import {
  calculateActualBet,
  commitBareDrop,
  settleBareDrop,
} from '../src/core/plinko-rules/drop';
import { createInitialGameState } from '../src/core/state/GameState';

describe('bare Plinko transaction', () => {
  it('calculates 25/50/100% quick bets and clamps to available cash', () => {
    expect(calculateActualBet(1000, 500, 0.25)).toBe(125);
    expect(calculateActualBet(1000, 500, 0.5)).toBe(250);
    expect(calculateActualBet(1000, 500, 1)).toBe(500);
    expect(calculateActualBet(100, 500, 1)).toBe(100);
  });

  it('debits stake before outcome and persists the selected fraction', () => {
    const initial = createInitialGameState(balance, 123);
    const committed = commitBareDrop(
      initial,
      null,
      balance,
      'drop-1',
      0.5,
    );

    expect(committed.pendingDrop.originalStake).toBe(250);
    expect(committed.pendingDrop.rngStateAtCommit).toBe(123);
    expect(committed.state.cash).toBe(250);
    expect(committed.state.plinkoSelectedBetFraction).toBe(0.5);
  });

  it('refuses a second Drop while one is pending', () => {
    const initial = createInitialGameState(balance, 123);
    const first = commitBareDrop(initial, null, balance, 'drop-1', 1);

    expect(() =>
      commitBareDrop(first.state, first.pendingDrop, balance, 'drop-2', 1),
    ).toThrow('already pending');
  });

  it('uses multiplier as total return and applies losing-Drop Happiness penalty', () => {
    const initial = createInitialGameState(balance, 123);
    const committed = commitBareDrop(initial, null, balance, 'drop-1', 1);

    const centerLoss = settleBareDrop(
      committed.state,
      committed.pendingDrop,
      4,
      balance,
    );

    expect(centerLoss.multiplier).toBe(0.25);
    expect(centerLoss.payout).toBe(125);
    expect(centerLoss.state.cash).toBe(125);
    expect(centerLoss.losing).toBe(true);
    expect(centerLoss.state.needs.happiness).toBe(99);
  });

  it('does not subtract stake twice from a winning total-return pocket', () => {
    const initial = createInitialGameState(balance, 123);
    const committed = commitBareDrop(initial, null, balance, 'drop-1', 1);
    const edgeWin = settleBareDrop(
      committed.state,
      committed.pendingDrop,
      0,
      balance,
    );

    expect(edgeWin.payout).toBe(6000);
    expect(edgeWin.state.cash).toBe(6000);
    expect(edgeWin.losing).toBe(false);
    expect(edgeWin.state.needs.happiness).toBe(100);
  });
});
