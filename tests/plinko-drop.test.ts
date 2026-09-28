import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import {
  assertDropBoardCompatible,
  calculateActualBet,
  commitBareDrop,
  setDropPhysicsSnapshot,
  settleAggregateDrop,
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
    expect(committed.pendingDrop.boardFingerprint.length).toBeGreaterThan(0);
    expect(committed.pendingDrop.physics).toBeNull();
  });

  it('persists an isolated physical snapshot and validates board compatibility', () => {
    const initial = createInitialGameState(balance, 123);
    const committed = commitBareDrop(initial, null, balance, 'drop-1', 1);
    const snapshot = {
      fixedTicksElapsed: 42,
      alreadySettledPayout: 0,
      balls: [
        {
          ballId: 'drop-1:root',
          x: 640,
          y: 200,
          velocityX: 1.25,
          velocityY: 2.5,
          angle: 0,
          angularVelocity: 0.1,
          currentValue: 1,
          lineageId: 'drop-1:root',
          splitDepth: 0,
          amplifierProcIds: ['amp-a'],
          returnUsed: false,
          blockedSplitterId: null,
        },
      ],
    };

    const pending = setDropPhysicsSnapshot(committed.pendingDrop, snapshot);
    snapshot.balls[0]!.amplifierProcIds.push('mutated-after-save');

    expect(pending.physics?.fixedTicksElapsed).toBe(42);
    expect(pending.physics?.balls[0]?.amplifierProcIds).toEqual(['amp-a']);
    expect(() => assertDropBoardCompatible(pending, balance)).not.toThrow();

    const incompatible = structuredClone(balance);
    incompatible.plinko.geometry.verticalPegSpacing += 1;
    expect(() => assertDropBoardCompatible(pending, incompatible)).toThrow(
      'fingerprint',
    );
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

  it('settles a multi-ball aggregate exactly once for cash and Happiness', () => {
    const initial = createInitialGameState(balance, 123);
    const committed = commitBareDrop(initial, null, balance, 'drop-agg', 1);

    const losingAggregate = settleAggregateDrop(
      committed.state,
      committed.pendingDrop,
      450,
      balance,
    );

    expect(losingAggregate.payout).toBe(450);
    expect(losingAggregate.multiplier).toBe(0.9);
    expect(losingAggregate.losing).toBe(true);
    expect(losingAggregate.state.cash).toBe(450);
    expect(losingAggregate.state.needs.happiness).toBe(99);

    const winningAggregate = settleAggregateDrop(
      committed.state,
      committed.pendingDrop,
      750,
      balance,
    );

    expect(winningAggregate.payout).toBe(750);
    expect(winningAggregate.multiplier).toBe(1.5);
    expect(winningAggregate.losing).toBe(false);
    expect(winningAggregate.state.cash).toBe(750);
    expect(winningAggregate.state.needs.happiness).toBe(100);
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
