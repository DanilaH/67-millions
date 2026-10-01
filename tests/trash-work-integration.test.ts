import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import { createInitialGameState } from '../src/core/state/GameState';
import { createGameClock } from '../src/core/time/GameClock';
import { completeWorkSkill } from '../src/core/work/skillCompletion';
import { startWork } from '../src/core/work/work';

describe('Trash work transaction integration', () => {
  it('settles successful Trash only after the configured 150-minute shift', () => {
    const initial = {
      ...createInitialGameState(balance, 801),
      cash: 1_000,
      clock: createGameClock('00:00'),
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
      'trash',
      1,
    );

    expect(started.state.needs.energy).toBe(82);
    expect(started.state.needs.happiness).toBe(95);
    expect(started.state.cash).toBe(1_000);

    const completed = completeWorkSkill(
      started.state,
      started.action,
      'SUCCESS',
      balance,
    );

    expect(completed.shiftCompleted).toBe(true);
    expect(completed.activeAction).toBeNull();
    expect(completed.advancedMinutes).toBe(150);
    expect(completed.state.clock.minuteOfDay).toBe(
      createGameClock('02:30').minuteOfDay,
    );
    expect(completed.state.cash).toBe(6_400);
  });

  it('does not charge Trash start costs again when an unresolved action is restored', () => {
    const initial = {
      ...createInitialGameState(balance, 802),
      clock: createGameClock('00:00'),
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
      'trash',
      1,
    );

    const restoredState = structuredClone(started.state);
    const restoredAction = structuredClone(started.action);

    expect(restoredState.needs.energy).toBe(82);
    expect(restoredState.needs.happiness).toBe(95);

    const completed = completeWorkSkill(
      restoredState,
      restoredAction,
      'SUCCESS',
      balance,
    );

    expect(completed.state.cash).toBe(
      initial.cash + balance.work.jobs.trash.levels[0]!.payout,
    );
    expect(completed.state.needs.energy).toBeLessThanOrEqual(82);
  });
});
