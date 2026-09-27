import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import { resolveBarryPayment } from '../src/core/barry/barry';
import { createInitialGameState } from '../src/core/state/GameState';
import { createGameClock } from '../src/core/time/GameClock';
import { advanceRunTime } from '../src/core/time/runTime';
import { setWorkResult, startWork, settleWork } from '../src/core/work/work';
import { startSleep } from '../src/core/sleep/sleep';

describe('run time lifecycle', () => {
  it('hard-stops an ordinary action at 09:00 and preserves its remaining duration', () => {
    const base = {
      ...createInitialGameState(balance, 1),
      cash: 5000,
      clock: createGameClock('08:50'),
    };
    const workBase = { ...base, clock: createGameClock('07:50') };
    const started = startWork(workBase, balance, 'trash', 1);
    const withResult = setWorkResult(started.action, 'SUCCESS');

    const preBarryState = { ...started.state, clock: createGameClock('08:50') };
    const advanced = advanceRunTime(preBarryState, withResult, 150, balance);

    expect(advanced.state.barryInterruptPending).toBe(true);
    expect(advanced.activeAction?.remainingMinutes).toBe(140);
    expect(advanced.state.cash).toBe(5000);

    const paid = resolveBarryPayment(advanced.state, balance);
    expect(paid.cash).toBe(2000);

    const resumed = advanceRunTime(
      paid,
      advanced.activeAction,
      advanced.activeAction!.remainingMinutes,
      balance,
    );
    expect(resumed.actionCompleted).toBe(true);

    const salary = settleWork(paid, withResult, balance);
    expect(salary.cash).toBeGreaterThan(paid.cash);
  });

  it('defers an action that completes exactly at 09:00 until Barry is paid', () => {
    const base = {
      ...createInitialGameState(balance, 1),
      cash: 5000,
      clock: createGameClock('08:00'),
    };
    const started = startWork(
      { ...base, clock: createGameClock('06:30') },
      balance,
      'trash',
      1,
    );
    const action = setWorkResult(
      { ...started.action, remainingMinutes: 60 },
      'SUCCESS',
    );

    const advanced = advanceRunTime(
      { ...started.state, clock: createGameClock('08:00') },
      action,
      60,
      balance,
    );

    expect(advanced.state.barryInterruptPending).toBe(true);
    expect(advanced.actionCompleted).toBe(false);
    expect(advanced.activeAction?.remainingMinutes).toBe(0);

    const paid = resolveBarryPayment(advanced.state, balance);
    const released = advanceRunTime(paid, advanced.activeAction, 0, balance);
    expect(released.actionCompleted).toBe(true);
    expect(released.activeAction).toBeNull();
  });

  it('cannot use future work salary to rescue a failed Barry payment', () => {
    const base = {
      ...createInitialGameState(balance, 1),
      cash: 1000,
      clock: createGameClock('07:50'),
    };
    const started = startWork(base, balance, 'trash', 1);
    const action = setWorkResult(started.action, 'SUCCESS');

    const advanced = advanceRunTime(
      { ...started.state, clock: createGameClock('08:50') },
      action,
      150,
      balance,
    );

    expect(advanced.state.cash).toBe(1000);
    expect(advanced.state.barryInterruptPending).toBe(true);

    const failed = resolveBarryPayment(advanced.state, balance);
    expect(failed.terminalReason).toBe('BARRY_PAYMENT_FAILED');
    expect(settleWork(failed, action, balance).cash).toBe(1000);
  });

  it('ends sleep at 09:00 instead of resuming it', () => {
    const state = {
      ...createInitialGameState(balance, 1),
      cash: 5000,
      clock: createGameClock('08:00'),
    };
    const sleep = startSleep(state, balance);
    const advanced = advanceRunTime(state, sleep, 420, balance);

    expect(advanced.state.barryInterruptPending).toBe(true);
    expect(advanced.activeAction).toBeNull();
    expect(advanced.actionCompleted).toBe(true);
  });
});
