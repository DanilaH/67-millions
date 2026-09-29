import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import {
  payMainDebt,
} from '../src/core/economy/mainDebt';
import {
  createInitialGameState,
  restartGame,
} from '../src/core/state/GameState';
import { createGameClock } from '../src/core/time/GameClock';
import {
  derivePrincipalConfirmation,
  deriveRunEndSummary,
} from '../src/game/end/runEndModel';

describe('T058 Game Over / Victory flow model', () => {
  it('requires explicit confirmation data without mutating a payable run', () => {
    const state = {
      ...createInitialGameState(balance, 1_201),
      cash: balance.game.mainDebt + 12_345,
    };

    const confirmation = derivePrincipalConfirmation(
      state,
      balance,
    );

    expect(confirmation).toEqual({
      amount: 67_000_000,
      cashBefore: 67_012_345,
      cashAfter: 12_345,
      title: 'ПОГАСИТЬ 67 МИЛЛИОНОВ?',
      warning:
        'Это ручное финальное действие. После подтверждения текущий забег завершится победой.',
    });
    expect(state.victory).toBe(false);
    expect(state.mainDebt).toBe(67_000_000);
    expect(state.cash).toBe(67_012_345);
  });

  it('builds Victory summary only after manual principal payment', () => {
    const payable = {
      ...createInitialGameState(balance, 1_202),
      cash: balance.game.mainDebt + 5_000,
      totalBarryPaid: 18_000,
      barryPaymentIndex: 4,
      clock: {
        ...createGameClock('18:42'),
        gameDayIndex: 3,
      },
      jobLevels: {
        dishes: 3,
        trash: 2,
        courier: 2,
      },
      plinkoMaxBetLevel: 4,
      plinkoCenterLevel: 2,
      plinkoMidLevel: 1,
    };

    const victory = payMainDebt(payable);
    const summary = deriveRunEndSummary(
      victory,
      balance,
    );

    expect(summary.kind).toBe('VICTORY');
    expect(summary.title).toBe('67 МИЛЛИОНОВ ПОГАШЕНЫ');
    expect(summary.reason).toContain(
      'Основной долг выплачен вручную',
    );
    expect(
      summary.stats.find(
        (stat) => stat.label === 'Основной долг погашен',
      )?.value,
    ).toBe('67 000 000 ₽');
    expect(
      summary.stats.find(
        (stat) => stat.label === 'Барри выплачено',
      )?.value,
    ).toBe('18 000 ₽');
    expect(
      summary.stats.find(
        (stat) => stat.label === 'Финиш',
      )?.value,
    ).toBe('День 4 · 18:42');
  });

  it('explains Barry-payment Game Over with a concrete reason', () => {
    const state = {
      ...createInitialGameState(balance, 1_203),
      cash: 900,
      terminalReason: 'BARRY_PAYMENT_FAILED' as const,
      clock: {
        ...createGameClock('09:00'),
        gameDayIndex: 2,
      },
    };

    const summary = deriveRunEndSummary(
      state,
      balance,
    );

    expect(summary.kind).toBe('GAME_OVER');
    expect(summary.title).toBe('ЗАБЕГ ОКОНЧЕН');
    expect(summary.reason).toBe(
      'В 09:00 не хватило денег на обязательный платёж Барри.',
    );
  });

  it('explains HP death separately from Barry failure', () => {
    const state = {
      ...createInitialGameState(balance, 1_204),
      terminalReason: 'HEALTH_ZERO' as const,
      needs: {
        health: 0,
        satiety: 0,
        energy: 12,
        happiness: 4,
      },
    };

    const summary = deriveRunEndSummary(
      state,
      balance,
    );

    expect(summary.reason).toBe('HP опустился до нуля.');
    expect(
      summary.stats.find(
        (stat) => stat.label === 'Потребности',
      )?.value,
    ).toBe('HP 0 · Сыт. 0 · Эн. 12 · Сч. 4');
  });

  it('rejects a terminal summary for a still-active run', () => {
    expect(() =>
      deriveRunEndSummary(
        createInitialGameState(balance, 1_205),
        balance,
      ),
    ).toThrow(
      'Run end summary requires Victory or Game Over',
    );
  });

  it('full restart resets run progression and terminal state', () => {
    const ended = {
      ...createInitialGameState(balance, 1_206),
      cash: 999_999,
      mainDebt: 0,
      victory: true,
      totalBarryPaid: 123_000,
      barryPaymentIndex: 7,
      jobLevels: {
        dishes: 3,
        trash: 3,
        courier: 3,
      },
      plinkoMaxBetLevel: 6,
      plinkoSplitterLevel: 5,
      statuses: { SMELLY: true },
    };

    const restarted = restartGame(
      balance,
      9_999,
    );

    expect(restarted).toEqual(
      createInitialGameState(balance, 9_999),
    );
    expect(restarted).not.toEqual(ended);
    expect(restarted.victory).toBe(false);
    expect(restarted.terminalReason).toBeNull();
    expect(restarted.mainDebt).toBe(67_000_000);
    expect(restarted.totalBarryPaid).toBe(0);
    expect(restarted.jobLevels).toEqual({
      dishes: 1,
      trash: 1,
      courier: 1,
    });
    expect(restarted.plinkoMaxBetLevel).toBe(0);
    expect(restarted.plinkoSplitterLevel).toBe(0);
    expect(restarted.statuses.SMELLY).toBe(false);
  });
});
