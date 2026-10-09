import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import { commitBareDrop } from '../src/core/plinko-rules/drop';
import { createInitialGameState } from '../src/core/state/GameState';
import {
  buildCasinoQuickBets,
  buildCasinoUpgradePreviews,
} from '../src/game/casino/casinoUiModel';
import {
  consumeCasinoPayoutToast,
  peekCasinoPayoutToast,
  publishCasinoPayoutToast,
} from '../src/game/casino/casinoPayoutToast';

describe('T057 casino UI model', () => {
  it('builds the three canonical quick bets with actual capped amounts', () => {
    const state = {
      ...createInitialGameState(balance, 1_101),
      cash: 4_000,
      plinkoMaxBetLevel: 2,
      plinkoSelectedBetFraction: 0.5 as const,
    };

    const bets = buildCasinoQuickBets(
      state,
      null,
      balance,
    );

    expect(bets.map((bet) => bet.fraction)).toEqual([
      0.25,
      0.5,
      1,
    ]);
    expect(bets.map((bet) => bet.amount)).toEqual([
      1_250,
      2_500,
      4_000,
    ]);
    expect(bets.map(bet => bet.label)).toEqual(bets.map(bet => `${bet.amount!.toLocaleString('ru-RU')} ₽`));
    expect(
      bets.find((bet) => bet.selected)?.fraction,
    ).toBe(0.5);
    expect(
      bets.every((bet) => bet.lockedReason === null),
    ).toBe(true);
  });

  it('shows all ten upgrade tracks with current/next state', () => {
    const state = {
      ...createInitialGameState(balance, 1_102),
      cash: 100_000,
    };

    const upgrades = buildCasinoUpgradePreviews(
      state,
      null,
      balance,
    );

    expect(upgrades.map((upgrade) => upgrade.id)).toEqual([
      'maxBet',
      'capacity',
      'center',
      'mid',
      'jackpot',
      'amplifier',
      'return',
      'splitter',
      'jackpotBias',
      'insurance',
    ]);

    const maxBet = upgrades.find(
      (upgrade) => upgrade.id === 'maxBet',
    );
    expect(maxBet).toMatchObject({
      currentLevel: 0,
      maxLevel: 6,
      nextPrice: 500,
      maxed: false,
      lockedReason: null,
    });

    const center = upgrades.find(
      (upgrade) => upgrade.id === 'center',
    );
    expect(center).toMatchObject({
      currentLevel: 0,
      maxLevel: 2,
      nextPrice: 500,
      maxed: false,
      lockedReason: null,
    });
  });

  it('allows another launch but locks every upgrade while a Drop is pending', () => {
    const state = {
      ...createInitialGameState(balance, 1_103),
      cash: 100_000,
    };
    const committed = commitBareDrop(
      state,
      null,
      balance,
      'casino-ui-lock-test',
      0.25,
    );

    const bets = buildCasinoQuickBets(
      committed.state,
      committed.pendingDrop,
      balance,
    );
    const upgrades = buildCasinoUpgradePreviews(
      committed.state,
      committed.pendingDrop,
      balance,
    );

    expect(
      bets.every(
        (bet) =>
          bet.lockedReason === null,
      ),
    ).toBe(true);
    expect(
      upgrades.every(
        (upgrade) =>
          upgrade.lockedReason ===
          'DROP ИДЁТ — ЗАБЛОКИРОВАНО',
      ),
    ).toBe(true);
  });

  it('marks maxed tracks and unaffordable upgrades explicitly', () => {
    const maxedState = {
      ...createInitialGameState(balance, 1_104),
      cash: 0,
      plinkoCenterLevel: 2,
    };

    const upgrades = buildCasinoUpgradePreviews(
      maxedState,
      null,
      balance,
    );

    expect(
      upgrades.find((upgrade) => upgrade.id === 'center'),
    ).toMatchObject({
      maxed: true,
      nextPrice: null,
      lockedReason: 'МАКСИМУМ',
    });

    expect(
      upgrades.find((upgrade) => upgrade.id === 'maxBet')
        ?.lockedReason,
    ).toBe('Не хватает 500 ₽');
  });

  it('publishes a payout toast exactly once for the Main Map', () => {
    while (consumeCasinoPayoutToast() !== null) {
      // clear module-local transient state
    }

    publishCasinoPayoutToast({
      stake: 500,
      payout: 1_250,
      multiplier: 2.5,
      losing: false,
      insuranceApplied: true,
      insuranceTopUp: 150,
    });

    expect(peekCasinoPayoutToast()).toEqual({
      stake: 500,
      payout: 1_250,
      multiplier: 2.5,
      losing: false,
      insuranceApplied: true,
      insuranceTopUp: 150,
    });
    expect(consumeCasinoPayoutToast()).not.toBeNull();
    expect(consumeCasinoPayoutToast()).toBeNull();
  });
});

it('describes return placement from the actual physics config', () => {
  const config = structuredClone(balance);
  config.plinko.returnPhysics.horizontalRetentionByLevel = [1, 1, 0.5, 0.5];
  const state = createInitialGameState(config, 123);
  const preview = () => buildCasinoUpgradePreviews(state, null, config).find(entry => entry.id === 'return')!;
  expect(preview().nextEffect).toContain('над местом касания');
  state.plinkoReturnLevel = 2;
  expect(preview().nextEffect).toContain('ближе к центру');
});
