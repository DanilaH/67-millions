import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import { commitBareDrop } from '../src/core/plinko-rules/drop';
import { createInitialGameState } from '../src/core/state/GameState';
import {
  purchaseJobUpgrade,
  setWorkResult,
  settleWork,
  startWork,
} from '../src/core/work/work';
import { createGameClock } from '../src/core/time/GameClock';

describe('work transaction', () => {
  it('starts every job at durable L1 ownership', () => {
    const state = createInitialGameState(balance, 1);

    expect(state.jobLevels).toEqual({
      dishes: 1,
      trash: 1,
      courier: 1,
    });
  });

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

  it('rejects an unowned job level', () => {
    const state = {
      ...createInitialGameState(balance, 1),
      clock: createGameClock('13:00'),
    };

    expect(() => startWork(state, balance, 'dishes', 2)).toThrow('not owned');
  });

  it('buys job upgrades strictly one configured level at a time', () => {
    const initial = {
      ...createInitialGameState(balance, 1),
      cash: 100_000,
    };

    const level2 = purchaseJobUpgrade(
      initial,
      null,
      null,
      balance,
      'dishes',
    );
    expect(level2.jobLevels.dishes).toBe(2);
    expect(level2.cash).toBe(
      100_000 - balance.work.jobs.dishes.levels[1]!.upgradePrice,
    );

    const level3 = purchaseJobUpgrade(
      level2,
      null,
      null,
      balance,
      'dishes',
    );
    expect(level3.jobLevels.dishes).toBe(3);
    expect(level3.cash).toBe(
      100_000 -
        balance.work.jobs.dishes.levels[1]!.upgradePrice -
        balance.work.jobs.dishes.levels[2]!.upgradePrice,
    );

    expect(() =>
      purchaseJobUpgrade(level3, null, null, balance, 'dishes'),
    ).toThrow('maxed');
  });

  it('rejects a job upgrade when cash is insufficient', () => {
    const state = createInitialGameState(balance, 1);

    expect(() =>
      purchaseJobUpgrade(state, null, null, balance, 'dishes'),
    ).toThrow('Insufficient cash');
  });

  it('locks job upgrades while a Drop is pending', () => {
    const state = {
      ...createInitialGameState(balance, 1),
      cash: 20_000,
    };
    const committed = commitBareDrop(
      state,
      null,
      balance,
      'work-upgrade-lock',
      1,
    );

    expect(() =>
      purchaseJobUpgrade(
        committed.state,
        null,
        committed.pendingDrop,
        balance,
        'dishes',
      ),
    ).toThrow('Drop is pending');
  });

  it('locks job upgrades while another action is active', () => {
    const state = {
      ...createInitialGameState(balance, 1),
      cash: 20_000,
      clock: createGameClock('16:00'),
    };
    const started = startWork(state, balance, 'dishes', 1);

    expect(() =>
      purchaseJobUpgrade(
        started.state,
        started.action,
        null,
        balance,
        'dishes',
      ),
    ).toThrow('action is active');
  });

  it('locks job upgrades while Barry is pending or the run has ended', () => {
    const base = {
      ...createInitialGameState(balance, 1),
      cash: 20_000,
    };

    expect(() =>
      purchaseJobUpgrade(
        { ...base, barryInterruptPending: true },
        null,
        null,
        balance,
        'dishes',
      ),
    ).toThrow('Barry is pending');

    expect(() =>
      purchaseJobUpgrade(
        { ...base, terminalReason: 'HEALTH_ZERO' },
        null,
        null,
        balance,
        'dishes',
      ),
    ).toThrow('run has ended');

    expect(() =>
      purchaseJobUpgrade(
        { ...base, victory: true, mainDebt: 0 },
        null,
        null,
        balance,
        'dishes',
      ),
    ).toThrow('run has ended');
  });

  it('keeps overnight windows half-open at both boundaries', () => {
    const state = {
      ...createInitialGameState(balance, 1),
      cash: 100_000,
    };
    const upgradedTrash = purchaseJobUpgrade(
      state,
      null,
      null,
      balance,
      'trash',
    );
    const upgradedDishes = purchaseJobUpgrade(
      upgradedTrash,
      null,
      null,
      balance,
      'dishes',
    );

    expect(() =>
      startWork(
        { ...upgradedTrash, clock: createGameClock('10:59') },
        balance,
        'trash',
        2,
      ),
    ).not.toThrow();
    expect(() =>
      startWork(
        { ...upgradedTrash, clock: createGameClock('11:00') },
        balance,
        'trash',
        2,
      ),
    ).toThrow('outside its start window');

    expect(() =>
      startWork(
        { ...upgradedDishes, clock: createGameClock('02:59') },
        balance,
        'dishes',
        2,
      ),
    ).not.toThrow();
    expect(() =>
      startWork(
        { ...upgradedDishes, clock: createGameClock('03:00') },
        balance,
        'dishes',
        2,
      ),
    ).toThrow('outside its start window');
  });

  it('allows owned L3 jobs at any time', () => {
    const initial = {
      ...createInitialGameState(balance, 1),
      cash: 100_000,
    };
    const level2 = purchaseJobUpgrade(
      initial,
      null,
      null,
      balance,
      'courier',
    );
    const level3 = purchaseJobUpgrade(
      level2,
      null,
      null,
      balance,
      'courier',
    );

    expect(() =>
      startWork(
        { ...level3, clock: createGameClock('23:59') },
        balance,
        'courier',
        3,
      ),
    ).not.toThrow();
  });

  it('settles the level stored on the shift even if owned progression later changes', () => {
    const state = {
      ...createInitialGameState(balance, 1),
      cash: 100_000,
      clock: createGameClock('16:00'),
    };
    const started = startWork(state, balance, 'dishes', 1);
    const action = setWorkResult(started.action, 'SUCCESS');
    const progressedState = {
      ...started.state,
      jobLevels: {
        ...started.state.jobLevels,
        dishes: 2,
      },
    };

    const settled = settleWork(progressedState, action, balance);

    expect(settled.cash).toBe(
      100_000 + balance.work.jobs.dishes.levels[0]!.payout,
    );
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

    expect(settled.cash).toBe(500 + 3825);
  });
});
