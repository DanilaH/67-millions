import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import { startDumpsterSearch } from '../src/core/actions/dumpster';
import {
  settleRecoveryAction,
  startEntertainment,
} from '../src/core/actions/foodEntertainment';
import {
  settleShower,
  startShower,
} from '../src/core/actions/shower';
import { commitBareDrop } from '../src/core/plinko-rules/drop';
import { createInitialGameState } from '../src/core/state/GameState';
import { createGameClock } from '../src/core/time/GameClock';
import { advanceRunTime } from '../src/core/time/runTime';
import { startWork } from '../src/core/work/work';

describe('SMELLY and shower', () => {
  it('starts clean and applies SMELLY immediately when a dumpster search starts', () => {
    const initial = createInitialGameState(balance, 1);
    expect(initial.statuses.SMELLY).toBe(false);

    const started = startDumpsterSearch(initial, null, null, balance);
    expect(started.state.statuses.SMELLY).toBe(true);
  });

  it('blocks courier while leaving dishes and trash available', () => {
    const smelly = {
      ...createInitialGameState(balance, 1),
      statuses: { SMELLY: true },
    };

    expect(() =>
      startWork(
        { ...smelly, clock: createGameClock('08:00') },
        balance,
        'courier',
        1,
      ),
    ).toThrow('courier job is blocked by SMELLY');

    expect(() =>
      startWork(
        { ...smelly, clock: createGameClock('16:00') },
        balance,
        'dishes',
        1,
      ),
    ).not.toThrow();

    expect(() =>
      startWork(
        { ...smelly, clock: createGameClock('00:00') },
        balance,
        'trash',
        1,
      ),
    ).not.toThrow();
  });

  it('halves paid entertainment happiness while SMELLY', () => {
    const smelly = {
      ...createInitialGameState(balance, 1),
      cash: 1_000,
      statuses: { SMELLY: true },
      needs: {
        health: 100,
        satiety: 100,
        energy: 100,
        happiness: 20,
      },
    };

    const started = startEntertainment(
      smelly,
      null,
      null,
      balance,
      'PC_CLUB',
    );
    expect(started.state.cash).toBe(500);

    const settled = settleRecoveryAction(
      started.state,
      started.action,
      balance,
    );
    expect(settled.needs.happiness).toBe(40);
  });

  it('does not reduce FREE_FUN while SMELLY', () => {
    const smelly = {
      ...createInitialGameState(balance, 1),
      cash: 0,
      statuses: { SMELLY: true },
      needs: {
        health: 100,
        satiety: 100,
        energy: 100,
        happiness: 20,
      },
    };

    const started = startEntertainment(
      smelly,
      null,
      null,
      balance,
      'FREE_FUN',
    );
    const settled = settleRecoveryAction(
      started.state,
      started.action,
      balance,
    );

    expect(settled.needs.happiness).toBe(35);
  });

  it('charges 300, takes 30 minutes, and clears SMELLY only on shower completion', () => {
    const smelly = {
      ...createInitialGameState(balance, 1),
      cash: 500,
      clock: createGameClock('10:00'),
      statuses: { SMELLY: true },
    };

    const started = startShower(smelly, null, null, balance);
    expect(started.state.cash).toBe(200);
    expect(started.state.statuses.SMELLY).toBe(true);
    expect(started.action.remainingMinutes).toBe(30);

    const advanced = advanceRunTime(
      started.state,
      started.action,
      started.action.remainingMinutes,
      balance,
    );
    expect(advanced.actionCompleted).toBe(true);
    expect(advanced.state.clock.minuteOfDay).toBe(
      createGameClock('10:30').minuteOfDay,
    );
    expect(advanced.state.statuses.SMELLY).toBe(true);

    const settled = settleShower(
      advanced.state,
      started.action,
      balance,
    );
    expect(settled.statuses.SMELLY).toBe(false);
  });

  it('keeps SMELLY if Game Over happens before shower completion', () => {
    const smelly = {
      ...createInitialGameState(balance, 1),
      cash: 500,
      statuses: { SMELLY: true },
    };
    const started = startShower(smelly, null, null, balance);
    const failed = {
      ...started.state,
      terminalReason: 'BARRY_PAYMENT_FAILED' as const,
    };

    const settled = settleShower(failed, started.action, balance);
    expect(settled.statuses.SMELLY).toBe(true);
    expect(settled.cash).toBe(200);
  });

  it('locks shower during a pending Drop or another active action', () => {
    const state = {
      ...createInitialGameState(balance, 1),
      cash: 10_000,
      statuses: { SMELLY: true },
    };

    const active = startShower(state, null, null, balance);
    expect(() =>
      startShower(active.state, active.action, null, balance),
    ).toThrow('another action is active');

    const committed = commitBareDrop(
      state,
      null,
      balance,
      'shower-lock',
      1,
    );
    expect(() =>
      startShower(
        committed.state,
        null,
        committed.pendingDrop,
        balance,
      ),
    ).toThrow('Drop is pending');
  });
});
