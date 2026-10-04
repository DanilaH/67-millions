import { expect, it } from 'vitest';
import { balance } from '../src/config/balance';
import { createInitialGameState } from '../src/core/state/GameState';
import { getFoodActionDefinition } from '../src/core/actions/foodEntertainment';
import { deriveMainMapHints } from '../src/game/map/mainMapModel';

it('uses effective event food prices without mutating the run', () => {
  const state = createInitialGameState(balance, 71);
  state.eventModifiers.foodPriceMultiplier = { multiplier: 2, remainingMinutes: 60 };
  const before = structuredClone(state);
  const cheapest = Math.min(...balance.food.map(entry => getFoodActionDefinition(state, entry).price));
  expect(deriveMainMapHints(state, balance).labels.food).toContain(`${cheapest.toLocaleString('ru-RU')} ₽`);
  expect(state).toEqual(before);
});

it('explains just one urgent need and clears it after recovery', () => {
  const state = createInitialGameState(balance, 72);
  state.needs.satiety = 0; state.needs.energy = 0;
  expect(deriveMainMapHints(state, balance).suggested).toBe('food');
  expect(deriveMainMapHints(state, balance).labels.food).toContain('Голод');
  state.needs.satiety = 100;
  expect(deriveMainMapHints(state, balance).suggested).toBe('home');
  state.needs.energy = 100; state.needs.happiness = 100;
  expect(deriveMainMapHints(state, balance).suggested).toBeNull();
});
