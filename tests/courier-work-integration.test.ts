import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import { createInitialGameState } from '../src/core/state/GameState';
import { createGameClock } from '../src/core/time/GameClock';
import { completeWorkSkill } from '../src/core/work/skillCompletion';
import { startWork } from '../src/core/work/work';

describe('Courier work transaction integration', () => {
  it('settles successful Courier only after the configured 180-minute shift', () => {
    const initial = {
      ...createInitialGameState(balance, 951),
      cash: 1_000,
      clock: createGameClock('10:00'),
      needs: {
        health: 100,
        satiety: 100,
        energy: 100,
        happiness: 100,
      },
    };
    const started = startWork(
      initial,
      balance,
      'courier',
      1,
    );

    expect(started.state.needs.energy).toBe(85);
    expect(started.state.needs.happiness).toBe(96);
    expect(started.state.cash).toBe(1_000);

    const completed = completeWorkSkill(
      started.state,
      started.action,
      'SUCCESS',
      balance,
    );

    expect(completed.shiftCompleted).toBe(true);
    expect(completed.activeAction).toBeNull();
    expect(completed.advancedMinutes).toBe(180);
    expect(completed.state.clock.minuteOfDay).toBe(
      createGameClock('13:00').minuteOfDay,
    );
    expect(completed.state.cash).toBe(5_200);
  });

  it('restored unresolved Courier work keeps its already-reserved start costs', () => {
    const initial = {
      ...createInitialGameState(balance, 952),
      clock: createGameClock('10:00'),
      needs: {
        health: 100,
        satiety: 100,
        energy: 100,
        happiness: 100,
      },
    };
    const started = startWork(
      initial,
      balance,
      'courier',
      1,
    );

    const restoredState = structuredClone(started.state);
    const restoredAction = structuredClone(started.action);

    expect(restoredState.needs.energy).toBe(85);
    expect(restoredState.needs.happiness).toBe(96);

    const completed = completeWorkSkill(
      restoredState,
      restoredAction,
      'SUCCESS',
      balance,
    );

    expect(completed.state.cash).toBe(
      initial.cash + balance.work.jobs.courier.levels[0]!.payout,
    );
    expect(completed.state.needs.energy).toBeLessThanOrEqual(85);
  });
});
