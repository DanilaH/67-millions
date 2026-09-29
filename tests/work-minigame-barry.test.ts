import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import { resolveBarryPayment } from '../src/core/barry/barry';
import { createInitialGameState } from '../src/core/state/GameState';
import { createGameClock } from '../src/core/time/GameClock';
import { completeWorkSkill } from '../src/core/work/skillCompletion';
import { WorkMinigameClock } from '../src/core/work/WorkMinigameClock';
import { startWork } from '../src/core/work/work';

const createCourierNearBarry = (seed: number, cash = 10_000) => {
  const state = {
    ...createInitialGameState(balance, seed),
    cash,
    clock: createGameClock('08:59'),
    needs: {
      health: 100,
      satiety: 100,
      energy: 100,
      happiness: 100,
    },
  };

  return startWork(
    state,
    balance,
    'courier',
    1,
  );
};

describe('Barry interruption during work minigames', () => {
  it('advances global time during skill input without consuming normative shift time', () => {
    const started = createCourierNearBarry(1_001);
    const actionBefore = structuredClone(started.action);
    const clock = new WorkMinigameClock(balance);

    const beforeBarry = clock.advance(
      started.state,
      2_999,
      balance,
    );

    expect(beforeBarry.advancedMinutes).toBe(0);
    expect(beforeBarry.state.clock).toEqual(
      started.state.clock,
    );
    expect(started.action).toEqual(actionBefore);

    const atBarry = clock.advance(
      beforeBarry.state,
      1,
      balance,
    );

    expect(atBarry.advancedMinutes).toBe(1);
    expect(atBarry.state.clock.minuteOfDay).toBe(
      createGameClock('09:00').minuteOfDay,
    );
    expect(atBarry.interruptedByBarry).toBe(true);
    expect(atBarry.state.barryInterruptPending).toBe(true);
    expect(started.action).toEqual(actionBefore);
    expect(started.action.remainingMinutes).toBe(180);
  });

  it('freezes the global minigame clock while Barry is pending and resumes after payment', () => {
    const started = createCourierNearBarry(1_002);
    const clock = new WorkMinigameClock(balance);

    const interrupted = clock.advance(
      started.state,
      3_000,
      balance,
    );
    expect(interrupted.state.barryInterruptPending).toBe(true);

    const frozen = clock.advance(
      interrupted.state,
      30_000,
      balance,
    );
    expect(frozen.advancedMinutes).toBe(0);
    expect(frozen.state.clock).toEqual(
      interrupted.state.clock,
    );

    const paid = resolveBarryPayment(
      frozen.state,
      balance,
    );
    expect(paid.barryInterruptPending).toBe(false);
    expect(paid.cash).toBe(7_000);

    const resumed = clock.advance(
      paid,
      3_000,
      balance,
    );
    expect(resumed.advancedMinutes).toBe(1);
    expect(resumed.state.clock.minuteOfDay).toBe(
      createGameClock('09:01').minuteOfDay,
    );
  });

  it('preserves the work transaction across Barry and settles only after the post-skill normative shift', () => {
    const started = createCourierNearBarry(1_003);
    const clock = new WorkMinigameClock(balance);

    const interrupted = clock.advance(
      started.state,
      3_000,
      balance,
    );
    const paid = resolveBarryPayment(
      interrupted.state,
      balance,
    );

    const completed = completeWorkSkill(
      paid,
      started.action,
      'SUCCESS',
      balance,
    );

    expect(completed.shiftCompleted).toBe(true);
    expect(completed.activeAction).toBeNull();
    expect(completed.advancedMinutes).toBe(180);
    expect(completed.state.clock.minuteOfDay).toBe(
      createGameClock('12:00').minuteOfDay,
    );
    expect(completed.state.cash).toBe(11_200);
  });

  it('ends the run before salary when Barry cannot be paid', () => {
    const started = createCourierNearBarry(1_004, 2_000);
    const clock = new WorkMinigameClock(balance);

    const interrupted = clock.advance(
      started.state,
      3_000,
      balance,
    );
    const failed = resolveBarryPayment(
      interrupted.state,
      balance,
    );

    expect(failed.terminalReason).toBe(
      'BARRY_PAYMENT_FAILED',
    );

    const completed = completeWorkSkill(
      failed,
      started.action,
      'SUCCESS',
      balance,
    );

    expect(completed.shiftCompleted).toBe(false);
    expect(completed.state.cash).toBe(2_000);
    expect(completed.state.terminalReason).toBe(
      'BARRY_PAYMENT_FAILED',
    );
  });

  it('applies needs decay while the skill minigame is active', () => {
    const started = createCourierNearBarry(1_005);
    const clock = new WorkMinigameClock(balance);

    const advanced = clock.advance(
      started.state,
      3_000,
      balance,
    );

    expect(advanced.state.needs.satiety).toBeLessThan(
      started.state.needs.satiety,
    );
    expect(advanced.state.needs.energy).toBeLessThan(
      started.state.needs.energy,
    );
    expect(advanced.state.needs.happiness).toBeLessThan(
      started.state.needs.happiness,
    );
  });
});
