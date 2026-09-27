import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import { advanceNeeds } from '../src/core/needs/needs';
import { finalizeSleepCycle } from '../src/core/sleep/sleep';
import { createInitialGameState } from '../src/core/state/GameState';

describe('needs and sleep', () => {
  it('decays awake needs from config', () => {
    const initial = createInitialGameState(balance, 1);
    const { state } = advanceNeeds(initial, 60, 'AWAKE', balance);

    expect(state.needs.satiety).toBeCloseTo(96);
    expect(state.needs.energy).toBeCloseTo(98.5);
    expect(state.needs.happiness).toBeCloseTo(99.7);
  });

  it('restores Energy fully across a seven-hour sleep and partially restores Health', () => {
    const initial = {
      ...createInitialGameState(balance, 1),
      needs: { health: 50, satiety: 100, energy: 30, happiness: 70 },
    };
    const { state } = advanceNeeds(initial, 7 * 60, 'SLEEP', balance);

    expect(state.needs.energy).toBeCloseTo(100);
    expect(state.needs.health).toBeCloseTo(70);
    expect(state.needs.happiness).toBeCloseTo(70);
    expect(state.needs.satiety).toBeCloseTo(72);
    expect(state.sleepMinutesCurrentGameDay).toBe(420);
  });

  it('turns missing sleep into next-cycle work payout penalty with the configured floor', () => {
    const initial = createInitialGameState(balance, 1);
    const noSleep = finalizeSleepCycle(initial, balance);
    expect(noSleep.workPayoutMultiplier).toBe(0.65);

    const fourHours = finalizeSleepCycle(
      { ...initial, sleepMinutesCurrentGameDay: 240 },
      balance,
    );
    expect(fourHours.workPayoutMultiplier).toBeCloseTo(0.85);
  });

  it('can reach HP death through stacked zero-need attrition', () => {
    const initial = {
      ...createInitialGameState(balance, 1),
      needs: { health: 5, satiety: 0, energy: 0, happiness: 0 },
    };
    const result = advanceNeeds(initial, 60, 'AWAKE', balance);

    expect(result.state.terminalReason).toBe('HEALTH_ZERO');
    expect(result.consumedMinutes).toBeLessThan(60);
  });
});
