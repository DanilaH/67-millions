import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import {
  commitBareDrop,
  settleAggregateDrop,
} from '../src/core/plinko-rules/drop';
import {
  purchaseInsuranceUpgrade,
} from '../src/core/plinko-rules/progression';
import { createInitialGameState } from '../src/core/state/GameState';

const settleNatural = (
  state: ReturnType<typeof createInitialGameState>,
  dropId: string,
  payout: number,
) => {
  const committed = commitBareDrop(
    state,
    null,
    balance,
    dropId,
    1,
  );
  return {
    committed,
    settled: settleAggregateDrop(
      committed.state,
      committed.pendingDrop,
      payout,
      balance,
    ),
  };
};

describe('Plinko Insurance lifecycle', () => {
  it('does not accumulate a losing streak before Insurance is owned', () => {
    const state = {
      ...createInitialGameState(balance, 1),
      cash: 10_000,
    };

    const { settled } = settleNatural(state, 'no-insurance', 0);

    expect(settled.state.plinkoInsuranceLossStreak).toBe(0);
    expect(settled.state.plinkoInsuranceArmed).toBeNull();
  });

  it('L1 arms the next Drop after exactly three natural losses', () => {
    let state = {
      ...createInitialGameState(balance, 2),
      cash: 10_000,
      plinkoInsuranceLevel: 1,
    };

    for (let index = 1; index <= 3; index += 1) {
      const { settled } = settleNatural(
        state,
        `loss-${index}`,
        0,
      );
      state = settled.state;

      expect(state.plinkoInsuranceLossStreak).toBe(index);
      expect(state.plinkoInsuranceArmed).toEqual(
        index === 3
          ? { level: 1, floor: 0.75 }
          : null,
      );
    }
  });

  it('consumes armed Insurance at commit and floors the natural aggregate payout', () => {
    const state = {
      ...createInitialGameState(balance, 3),
      cash: 10_000,
      plinkoInsuranceLevel: 1,
      plinkoInsuranceLossStreak: 3,
      plinkoInsuranceArmed: {
        level: 1,
        floor: 0.75,
      },
    };

    const committed = commitBareDrop(
      state,
      null,
      balance,
      'insured-loss',
      1,
    );

    expect(committed.state.plinkoInsuranceArmed).toBeNull();
    expect(committed.state.plinkoInsuranceLossStreak).toBe(3);
    expect(committed.pendingDrop.insuranceAtCommit).toEqual({
      level: 1,
      floor: 0.75,
    });

    const settled = settleAggregateDrop(
      committed.state,
      committed.pendingDrop,
      100,
      balance,
    );

    expect(settled.naturalPayout).toBe(100);
    expect(settled.naturalMultiplier).toBe(0.2);
    expect(settled.payout).toBe(375);
    expect(settled.multiplier).toBe(0.75);
    expect(settled.insuranceApplied).toBe(true);
    expect(settled.insuranceTopUp).toBe(275);
    expect(settled.losing).toBe(true);
    expect(settled.state.plinkoInsuranceLossStreak).toBe(0);
    expect(settled.state.plinkoInsuranceArmed).toBeNull();
    expect(settled.state.needs.happiness).toBe(99);
  });

  it('consumes armed Insurance even when the natural result beats its floor', () => {
    const state = {
      ...createInitialGameState(balance, 4),
      cash: 10_000,
      plinkoInsuranceLevel: 1,
      plinkoInsuranceLossStreak: 3,
      plinkoInsuranceArmed: {
        level: 1,
        floor: 0.75,
      },
    };

    const { committed, settled } = settleNatural(
      state,
      'insured-win',
      1_000,
    );

    expect(committed.pendingDrop.insuranceAtCommit).toEqual({
      level: 1,
      floor: 0.75,
    });
    expect(settled.payout).toBe(1_000);
    expect(settled.insuranceApplied).toBe(true);
    expect(settled.insuranceTopUp).toBe(0);
    expect(settled.losing).toBe(false);
    expect(settled.state.plinkoInsuranceLossStreak).toBe(0);
    expect(settled.state.plinkoInsuranceArmed).toBeNull();
  });

  it('uses configured L2 and L3 thresholds and floors', () => {
    const l2 = {
      ...createInitialGameState(balance, 5),
      cash: 10_000,
      plinkoInsuranceLevel: 2,
      plinkoInsuranceLossStreak: 1,
    };
    const l2Loss = settleNatural(l2, 'l2-arm', 0).settled;
    expect(l2Loss.state.plinkoInsuranceArmed).toEqual({
      level: 2,
      floor: 0.9,
    });

    const l3 = {
      ...createInitialGameState(balance, 6),
      cash: 10_000,
      plinkoInsuranceLevel: 3,
    };
    const l3Loss = settleNatural(l3, 'l3-arm', 0).settled;
    expect(l3Loss.state.plinkoInsuranceArmed).toEqual({
      level: 3,
      floor: 1,
    });
  });

  it('a non-losing unarmed Drop resets the losing streak', () => {
    const state = {
      ...createInitialGameState(balance, 7),
      cash: 10_000,
      plinkoInsuranceLevel: 1,
      plinkoInsuranceLossStreak: 2,
    };

    const { settled } = settleNatural(
      state,
      'streak-reset',
      500,
    );

    expect(settled.losing).toBe(false);
    expect(settled.state.plinkoInsuranceLossStreak).toBe(0);
    expect(settled.state.plinkoInsuranceArmed).toBeNull();
  });

  it('upgrading while armed does not retroactively improve the earned floor', () => {
    const armedL1 = {
      ...createInitialGameState(balance, 8),
      cash: 20_000,
      plinkoInsuranceLevel: 1,
      plinkoInsuranceLossStreak: 3,
      plinkoInsuranceArmed: {
        level: 1,
        floor: 0.75,
      },
    };

    const upgraded = purchaseInsuranceUpgrade(
      armedL1,
      null,
      balance,
    );
    expect(upgraded.plinkoInsuranceLevel).toBe(2);
    expect(upgraded.plinkoInsuranceArmed).toEqual({
      level: 1,
      floor: 0.75,
    });

    const committed = commitBareDrop(
      upgraded,
      null,
      balance,
      'old-arm-new-level',
      1,
    );

    expect(committed.pendingDrop.insuranceAtCommit).toEqual({
      level: 1,
      floor: 0.75,
    });
  });

  it('locks Insurance purchases while a Drop is pending', () => {
    const state = {
      ...createInitialGameState(balance, 9),
      cash: 10_000,
    };
    const committed = commitBareDrop(
      state,
      null,
      balance,
      'pending-lock',
      1,
    );

    expect(() =>
      purchaseInsuranceUpgrade(
        committed.state,
        committed.pendingDrop,
        balance,
      ),
    ).toThrow('pending');
  });
});
