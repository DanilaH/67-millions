import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import { commitBareDrop } from '../src/core/plinko-rules/drop';
import {
  advancePendingDropTime,
  settlePendingDropAndResumeTime,
} from '../src/core/plinko-rules/dropTiming';
import { createInitialGameState } from '../src/core/state/GameState';
import { createGameClock, formatClockTime } from '../src/core/time/GameClock';

describe('Plinko Drop 09:00 ordering', () => {
  it('freezes at 09:00 with remaining Drop minutes while physical cascade is pending', () => {
    const state = {
      ...createInitialGameState(balance, 1),
      cash: 1000,
      clock: createGameClock('08:50'),
    };
    const committed = commitBareDrop(state, null, balance, 'drop-crossing', 1);

    const timed = advancePendingDropTime(
      committed.state,
      committed.pendingDrop,
      balance,
    );

    expect(formatClockTime(timed.state.clock.minuteOfDay)).toBe('09:00');
    expect(timed.state.barryInterruptPending).toBe(true);
    expect(timed.pendingDrop.remainingActionMinutes).toBe(5);
    expect(timed.advancedMinutes).toBe(10);
    expect(timed.state.cash).toBe(500);
  });

  it('lets the resolved payout fund Barry before remaining Drop time continues', () => {
    const state = {
      ...createInitialGameState(balance, 1),
      cash: 1000,
      clock: createGameClock('08:50'),
    };
    const committed = commitBareDrop(state, null, balance, 'drop-rescue', 1);
    const timed = advancePendingDropTime(
      committed.state,
      committed.pendingDrop,
      balance,
    );

    const settled = settlePendingDropAndResumeTime(
      timed.state,
      timed.pendingDrop,
      0,
      balance,
    );

    expect(settled.payout).toBe(6000);
    expect(settled.state.terminalReason).toBeNull();
    expect(settled.state.barryInterruptPending).toBe(false);
    expect(settled.state.cash).toBe(3500);
    expect(settled.state.totalBarryPaid).toBe(3000);
    expect(settled.state.barryPaymentIndex).toBe(1);
    expect(settled.remainingMinutesAdvancedAfterBarry).toBe(5);
    expect(formatClockTime(settled.state.clock.minuteOfDay)).toBe('09:05');
    expect(settled.pendingDrop).toBeNull();
  });

  it('fails Barry after payout when the aggregate return is still insufficient and does not advance remaining minutes', () => {
    const state = {
      ...createInitialGameState(balance, 1),
      cash: 3300,
      clock: createGameClock('08:50'),
    };
    const committed = commitBareDrop(state, null, balance, 'drop-fail', 1);
    const timed = advancePendingDropTime(
      committed.state,
      committed.pendingDrop,
      balance,
    );

    const settled = settlePendingDropAndResumeTime(
      timed.state,
      timed.pendingDrop,
      4,
      balance,
    );

    expect(settled.payout).toBe(125);
    expect(settled.state.cash).toBe(2925);
    expect(settled.state.terminalReason).toBe('BARRY_PAYMENT_FAILED');
    expect(settled.remainingMinutesAdvancedAfterBarry).toBe(0);
    expect(formatClockTime(settled.state.clock.minuteOfDay)).toBe('09:00');
    expect(settled.pendingDrop).toBeNull();
  });

  it('advances all Drop action time immediately when no Barry boundary is crossed', () => {
    const state = {
      ...createInitialGameState(balance, 1),
      cash: 1000,
      clock: createGameClock('10:00'),
    };
    const committed = commitBareDrop(state, null, balance, 'drop-normal', 1);

    const timed = advancePendingDropTime(
      committed.state,
      committed.pendingDrop,
      balance,
    );

    expect(timed.pendingDrop.remainingActionMinutes).toBe(0);
    expect(timed.state.barryInterruptPending).toBe(false);
    expect(formatClockTime(timed.state.clock.minuteOfDay)).toBe('10:15');

    const settled = settlePendingDropAndResumeTime(
      timed.state,
      timed.pendingDrop,
      3,
      balance,
    );

    expect(settled.payout).toBe(500);
    expect(settled.state.cash).toBe(1000);
    expect(formatClockTime(settled.state.clock.minuteOfDay)).toBe('10:15');
  });

  it('treats a Drop ending exactly at 09:00 as Barry-pending until cascade settlement', () => {
    const state = {
      ...createInitialGameState(balance, 1),
      cash: 4000,
      clock: createGameClock('08:45'),
    };
    const committed = commitBareDrop(state, null, balance, 'drop-exact', 1);

    const timed = advancePendingDropTime(
      committed.state,
      committed.pendingDrop,
      balance,
    );

    expect(timed.pendingDrop.remainingActionMinutes).toBe(0);
    expect(timed.state.barryInterruptPending).toBe(true);
    expect(formatClockTime(timed.state.clock.minuteOfDay)).toBe('09:00');

    const settled = settlePendingDropAndResumeTime(
      timed.state,
      timed.pendingDrop,
      3,
      balance,
    );

    expect(settled.state.terminalReason).toBeNull();
    expect(settled.state.barryInterruptPending).toBe(false);
    expect(formatClockTime(settled.state.clock.minuteOfDay)).toBe('09:00');
  });
});
