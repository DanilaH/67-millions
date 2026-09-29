import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import { createInitialGameState } from '../src/core/state/GameState';
import { createGameClock } from '../src/core/time/GameClock';
import {
  deriveMainMapLocations,
} from '../src/game/map/mainMapModel';
import {
  deriveHudSnapshot,
  formatBarryCountdown,
} from '../src/game/ui/hudModel';

describe('T055 persistent HUD and Main Map model', () => {
  it('exposes the complete HUD contract from authoritative state', () => {
    const state = {
      ...createInitialGameState(balance, 55),
      cash: 12_345,
      clock: createGameClock('08:30'),
      statuses: { SMELLY: true },
      needs: {
        health: 81,
        satiety: 63,
        energy: 42,
        happiness: 17,
      },
    };

    const hud = deriveHudSnapshot(state, balance);

    expect(hud.time).toBe('08:30');
    expect(hud.cash).toBe(12_345);
    expect(hud.nextBarry).toBe(3_000);
    expect(hud.minutesUntilBarry).toBe(30);
    expect(hud.mainDebt).toBe(67_000_000);
    expect(hud.needs.map((need) => need.id)).toEqual([
      'health',
      'satiety',
      'energy',
      'happiness',
    ]);
    expect(hud.statuses).toEqual(['ВОНЮЧИЙ']);
  });

  it('shows Barry as due now instead of a false 24-hour countdown', () => {
    const state = {
      ...createInitialGameState(balance, 56),
      clock: createGameClock('09:00'),
      barryInterruptPending: true,
    };

    expect(
      deriveHudSnapshot(state, balance).minutesUntilBarry,
    ).toBe(0);
  });

  it('formats countdowns compactly for the HUD', () => {
    expect(formatBarryCountdown(0)).toBe('0м');
    expect(formatBarryCountdown(59)).toBe('59м');
    expect(formatBarryCountdown(60)).toBe('1ч 00м');
    expect(formatBarryCountdown(125)).toBe('2ч 05м');
  });

  it('keeps every Main Map navigation hop at zero game minutes', () => {
    const locations = deriveMainMapLocations(balance);

    expect(locations).toHaveLength(7);
    expect(
      locations.every(
        (location) => location.timeCostMinutes === 0,
      ),
    ).toBe(true);
    expect(new Set(locations.map((location) => location.id))).toEqual(
      new Set([
        'work',
        'food',
        'home',
        'entertainment',
        'dumpster',
        'shower',
        'casino',
      ]),
    );
  });
});
