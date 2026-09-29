import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import { resolveBarryPayment } from '../src/core/barry/barry';
import {
  settleRecoveryAction,
  startEntertainment,
  startFood,
} from '../src/core/actions/foodEntertainment';
import { commitBareDrop } from '../src/core/plinko-rules/drop';
import { createInitialGameState } from '../src/core/state/GameState';
import { createGameClock } from '../src/core/time/GameClock';
import { advanceRunTime } from '../src/core/time/runTime';

const clampNeed = (value: number): number =>
  Math.min(balance.needs.max, Math.max(balance.needs.min, value));

describe('food and entertainment', () => {
  it.each(balance.food.map((entry) => [entry.id, entry] as const))(
    'uses config values for food %s',
    (_id, entry) => {
      const initial = {
        ...createInitialGameState(balance, 1),
        cash: 10_000,
        needs: {
          health: 50,
          satiety: 50,
          energy: 50,
          happiness: 50,
        },
      };

      const started = startFood(initial, null, null, balance, entry.id);

      expect(started.state.cash).toBe(10_000 - entry.price);
      expect(started.state.needs).toEqual(initial.needs);
      expect(started.action.actionId).toBe(entry.id);
      expect(started.action.remainingMinutes).toBe(entry.durationMinutes);

      const settled = settleRecoveryAction(
        started.state,
        started.action,
        balance,
      );

      expect(settled.needs).toEqual({
        health: clampNeed(50 + entry.hp),
        satiety: clampNeed(50 + entry.satiety),
        energy: clampNeed(50 + entry.energy),
        happiness: clampNeed(50 + entry.happiness),
      });
    },
  );

  it.each(balance.entertainment.map((entry) => [entry.id, entry] as const))(
    'uses config values for entertainment %s',
    (_id, entry) => {
      const initial = {
        ...createInitialGameState(balance, 1),
        cash: 10_000,
        needs: {
          health: 50,
          satiety: 50,
          energy: 50,
          happiness: 20,
        },
      };

      const started = startEntertainment(
        initial,
        null,
        null,
        balance,
        entry.id,
      );

      expect(started.state.cash).toBe(10_000 - entry.price);
      expect(started.state.needs.happiness).toBe(20);
      expect(started.action.actionId).toBe(entry.id);
      expect(started.action.remainingMinutes).toBe(entry.durationMinutes);

      const settled = settleRecoveryAction(
        started.state,
        started.action,
        balance,
      );
      expect(settled.needs.happiness).toBe(
        clampNeed(20 + entry.happiness),
      );
    },
  );

  it('keeps FREE_FUN available at zero cash', () => {
    const initial = {
      ...createInitialGameState(balance, 1),
      cash: 0,
      needs: {
        health: 100,
        satiety: 100,
        energy: 100,
        happiness: 10,
      },
    };

    const started = startEntertainment(
      initial,
      null,
      null,
      balance,
      'FREE_FUN',
    );

    expect(started.state.cash).toBe(0);
    expect(started.action.remainingMinutes).toBe(60);

    const settled = settleRecoveryAction(
      started.state,
      started.action,
      balance,
    );
    expect(settled.needs.happiness).toBe(25);
  });

  it('rejects paid recovery when cash is insufficient', () => {
    const initial = {
      ...createInitialGameState(balance, 1),
      cash: 499,
    };

    expect(() =>
      startEntertainment(initial, null, null, balance, 'PC_CLUB'),
    ).toThrow('Insufficient cash');
  });

  it('locks recovery actions while another action or Drop is active', () => {
    const initial = {
      ...createInitialGameState(balance, 1),
      cash: 10_000,
    };
    const food = startFood(initial, null, null, balance, 'FOOD_02');

    expect(() =>
      startEntertainment(
        food.state,
        food.action,
        null,
        balance,
        'FREE_FUN',
      ),
    ).toThrow('another action is active');

    const committed = commitBareDrop(
      initial,
      null,
      balance,
      'recovery-lock',
      1,
    );
    expect(() =>
      startFood(
        committed.state,
        null,
        committed.pendingDrop,
        balance,
        'FOOD_01',
      ),
    ).toThrow('Drop is pending');
  });

  it('uses scheduler duration before granting the completion effect', () => {
    const initial = {
      ...createInitialGameState(balance, 1),
      clock: createGameClock('09:05'),
      needs: {
        health: 100,
        satiety: 40,
        energy: 100,
        happiness: 100,
      },
    };
    const started = startFood(initial, null, null, balance, 'FOOD_02');

    const advanced = advanceRunTime(
      started.state,
      started.action,
      started.action.remainingMinutes,
      balance,
    );

    expect(advanced.advancedMinutes).toBe(10);
    expect(advanced.state.clock.minuteOfDay).toBe(
      createGameClock('09:15').minuteOfDay,
    );
    expect(advanced.actionCompleted).toBe(true);
    expect(advanced.activeAction).toBeNull();

    const beforeCompletion = advanced.state.needs.satiety;
    const settled = settleRecoveryAction(
      advanced.state,
      started.action,
      balance,
    );
    expect(settled.needs.satiety).toBe(
      clampNeed(beforeCompletion + 20),
    );
  });

  it('pauses a recovery action at Barry and resumes remaining time after payment', () => {
    const initial = {
      ...createInitialGameState(balance, 1),
      cash: 5_000,
      clock: createGameClock('08:50'),
      needs: {
        health: 100,
        satiety: 40,
        energy: 100,
        happiness: 100,
      },
    };
    const started = startFood(initial, null, null, balance, 'FOOD_01');

    const interrupted = advanceRunTime(
      started.state,
      started.action,
      started.action.remainingMinutes,
      balance,
    );

    expect(interrupted.state.barryInterruptPending).toBe(true);
    expect(interrupted.advancedMinutes).toBe(10);
    expect(interrupted.activeAction?.remainingMinutes).toBe(35);

    const paid = resolveBarryPayment(interrupted.state, balance);
    expect(paid.terminalReason).toBeNull();

    const resumed = advanceRunTime(
      paid,
      interrupted.activeAction,
      interrupted.activeAction!.remainingMinutes,
      balance,
    );

    expect(resumed.actionCompleted).toBe(true);
    expect(resumed.activeAction).toBeNull();

    const beforeCompletion = resumed.state.needs.satiety;
    const settled = settleRecoveryAction(
      resumed.state,
      started.action,
      balance,
    );
    expect(settled.needs.satiety).toBe(
      clampNeed(beforeCompletion + 30),
    );
  });

  it('does not grant a recovery effect after terminal failure', () => {
    const initial = {
      ...createInitialGameState(balance, 1),
      cash: 10_000,
      needs: {
        health: 100,
        satiety: 50,
        energy: 100,
        happiness: 100,
      },
    };
    const started = startFood(initial, null, null, balance, 'FOOD_01');
    const failed = {
      ...started.state,
      terminalReason: 'BARRY_PAYMENT_FAILED' as const,
    };

    const settled = settleRecoveryAction(failed, started.action, balance);
    expect(settled.needs.satiety).toBe(50);
  });

  it('rejects unknown recovery ids instead of inventing content', () => {
    const initial = {
      ...createInitialGameState(balance, 1),
      cash: 10_000,
    };

    expect(() =>
      startFood(initial, null, null, balance, 'NOT_FOOD'),
    ).toThrow('Unknown food');
    expect(() =>
      startEntertainment(initial, null, null, balance, 'NOT_FUN'),
    ).toThrow('Unknown entertainment');
  });
});
