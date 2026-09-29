import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import { createInitialGameState } from '../src/core/state/GameState';
import { createGameClock } from '../src/core/time/GameClock';
import { completeWorkSkill } from '../src/core/work/skillCompletion';
import { setWorkResult, startWork } from '../src/core/work/work';

describe('Dishes work transaction integration', () => {
  it('settles a successful Dishes skill only after the normative 120-minute shift', () => {
    const initial = {
      ...createInitialGameState(balance, 701),
      cash: 1_000,
      clock: createGameClock('16:00'),
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
      'dishes',
      1,
    );

    expect(started.state.cash).toBe(1_000);
    expect(started.state.needs.energy).toBe(88);
    expect(started.state.needs.happiness).toBe(97);
    expect(started.action.result).toBeNull();

    const completed = completeWorkSkill(
      started.state,
      started.action,
      'SUCCESS',
      balance,
    );

    expect(completed.shiftCompleted).toBe(true);
    expect(completed.activeAction).toBeNull();
    expect(completed.advancedMinutes).toBe(120);
    expect(completed.state.clock.minuteOfDay).toBe(
      createGameClock('18:00').minuteOfDay,
    );
    expect(completed.state.cash).toBe(4_000);
  });

  it('applies the configured failure fine and Happiness penalty after the shift', () => {
    const initial = {
      ...createInitialGameState(balance, 702),
      cash: 5_000,
      clock: createGameClock('16:00'),
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
      'dishes',
      1,
    );

    const completed = completeWorkSkill(
      started.state,
      started.action,
      'FAILURE',
      balance,
    );

    expect(completed.shiftCompleted).toBe(true);
    expect(completed.activeAction).toBeNull();
    expect(completed.state.cash).toBe(4_250);
    expect(completed.state.needs.happiness).toBeLessThan(89);
    expect(completed.state.needs.happiness).toBeGreaterThan(80);
  });

  it('preserves an already-reserved Dishes action through reload without charging work costs again', () => {
    const initial = {
      ...createInitialGameState(balance, 703),
      clock: createGameClock('16:00'),
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
      'dishes',
      1,
    );

    const reloadedState = structuredClone(started.state);
    const reloadedAction = structuredClone(started.action);

    expect(reloadedState.needs.energy).toBe(88);
    expect(reloadedState.needs.happiness).toBe(97);

    const completed = completeWorkSkill(
      reloadedState,
      reloadedAction,
      'SUCCESS',
      balance,
    );

    expect(completed.state.needs.energy).toBeLessThanOrEqual(88);
    expect(completed.state.cash).toBe(
      initial.cash + balance.work.jobs.dishes.levels[0]!.payout,
    );
  });

  it('rejects resolving the same work skill twice', () => {
    const initial = {
      ...createInitialGameState(balance, 704),
      clock: createGameClock('16:00'),
    };
    const started = startWork(
      initial,
      balance,
      'dishes',
      1,
    );
    const resolved = setWorkResult(
      started.action,
      'SUCCESS',
    );

    expect(() =>
      completeWorkSkill(
        started.state,
        resolved,
        'SUCCESS',
        balance,
      ),
    ).toThrow('already resolved');
  });
});
