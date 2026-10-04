import { describe, expect, it } from 'vitest';
import { forecastRecovery } from '../src/game/actions/needsForecast';
import { balance } from '../src/config/balance';
import { createInitialGameState } from '../src/core/state/GameState';
import { advanceNeeds } from '../src/core/needs/needs';
import { getFoodActionDefinition } from '../src/core/actions/foodEntertainment';
import { applyTimedPaidCompletion } from '../src/core/actions/timedPaidAction';

describe('needs forecast', () => {
  it('includes time attrition and completion caps without mutating state or RNG', () => {
    const state = createInitialGameState(balance, 876);
    state.clock.minuteOfDay = 600;
    state.needs.satiety = 90;
    const before = JSON.stringify(state);
    const definition = getFoodActionDefinition(state, balance.food[0]!);
    const forecast = forecastRecovery(state, definition, balance);
    const expected = applyTimedPaidCompletion(advanceNeeds(state, definition.durationMinutes, 'AWAKE', balance).state, definition, balance);
    expect(forecast.needs).toEqual(expected.needs);
    expect(forecast.needs.satiety).toBeLessThanOrEqual(balance.needs.max);
    expect(forecast.needs.energy).toBeLessThan(state.needs.energy);
    expect(JSON.stringify(state)).toBe(before);
  });
  it('does not promise a recovery before Barry interrupts it', () => {
    const state = createInitialGameState(balance, 877);
    state.clock.minuteOfDay = 539;
    state.needs.satiety = 40;
    const forecast = forecastRecovery(state, getFoodActionDefinition(state, balance.food[0]!), balance);
    expect(forecast.needs).toEqual(advanceNeeds(state, 1, 'AWAKE', balance).state.needs);
    expect(forecast.caption).toContain('ещё не завершится');
  });
  it('never applies recovery after lethal attrition', () => {
    const state = createInitialGameState(balance, 878);
    state.clock.minuteOfDay = 600;
    state.needs = { health: 0.001, satiety: 0, energy: 0, happiness: 0 };
    const forecast = forecastRecovery(state, getFoodActionDefinition(state, balance.food[0]!), balance);
    expect(forecast.needs.health).toBe(0);
    expect(forecast.caption).toContain('Опасно');
  });
});
