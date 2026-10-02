import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import { startSleep } from '../src/core/sleep/sleep';
import { createInitialGameState } from '../src/core/state/GameState';
import {
  buildDumpsterPreviews,
  buildEntertainmentPreviews,
  buildFoodPreviews,
  buildWorkPreviews,
  buildWorkUpgradePreviews,
  buildSleepPreviews,
} from '../src/game/actions/actionPreviews';

describe('T056 action previews', () => {
  it('shows work payout/time/costs and readable schedule locks', () => {
    const state = createInitialGameState(balance, 5601);
    const previews = buildWorkPreviews(
      state,
      null,
      null,
      balance,
    );

    const dishes = previews.find(
      (preview) => preview.id === 'work:dishes',
    )!;
    const courier = previews.find(
      (preview) => preview.id === 'work:courier',
    )!;

    expect(dishes.summary.join(' ')).toContain('120 мин');
    expect(dishes.summary.join(' ')).toContain('энергия -12');
    expect(dishes.summary.join(' ')).toContain('счастье -3');
    expect(dishes.lockedReason).toBe(
      'Сейчас работа закрыта',
    );

    expect(courier.summary.join(' ')).toContain('180 мин');
    expect(courier.lockedReason).toBeNull();
  });

  it('surfaces SMELLY as a readable Courier lock', () => {
    const state = {
      ...createInitialGameState(balance, 5602),
      statuses: { SMELLY: true },
    };

    const courier = buildWorkPreviews(
      state,
      null,
      null,
      balance,
    ).find(
      (preview) => preview.id === 'work:courier',
    )!;

    expect(courier.lockedReason).toBe(
      'Сначала смой статус ВОНЮЧИЙ',
    );
  });

  it('uses effective event-adjusted food price and cash validation', () => {
    const state = {
      ...createInitialGameState(balance, 5603),
      eventModifiers: {
        ...createInitialGameState(balance, 5603)
          .eventModifiers,
        foodPriceMultiplier: {
          multiplier: 1.3,
          remainingMinutes: 120,
        },
      },
    };

    const previews = buildFoodPreviews(
      state,
      null,
      null,
      balance,
    );
    const cheap = previews.find(
      (preview) => preview.id === 'food:FOOD_01',
    )!;
    const expensive = previews.find(
      (preview) => preview.id === 'food:FOOD_08',
    )!;

    expect(cheap.summary.join(' ')).toContain('195 ₽');
    expect(cheap.lockedReason).toBeNull();
    expect(expensive.lockedReason).toBe(
      'Недостаточно денег',
    );
  });

  it('shows the reduced paid-entertainment effect while SMELLY', () => {
    const state = {
      ...createInitialGameState(balance, 5604),
      cash: 5_000,
      statuses: { SMELLY: true },
    };

    const pcClub = buildEntertainmentPreviews(
      state,
      null,
      null,
      balance,
    ).find(
      (preview) =>
        preview.id === 'entertainment:PC_CLUB',
    )!;

    expect(pcClub.summary.join(' ')).toContain(
      'счастье +20',
    );
    expect(pcClub.lockedReason).toBeNull();
  });

  it('keeps dumpster recovery available at zero Energy/Happiness and previews HP overflow', () => {
    const state = {
      ...createInitialGameState(balance, 5605),
      cash: 0,
      needs: {
        health: 100,
        satiety: 0,
        energy: 0,
        happiness: 0,
      },
    };

    const preview = buildDumpsterPreviews(
      state,
      null,
      null,
      balance,
    )[0]!;

    expect(preview.lockedReason).toBeNull();
    expect(preview.summary.join(' ')).toContain(
      'энергия -0',
    );
    expect(preview.summary.join(' ')).toContain(
      'счастье -0.0',
    );
    expect(preview.summary.join(' ')).toContain(
      'HP -7.5',
    );
  });

  it('shows the current-action lock instead of allowing overlapping recovery actions', () => {
    const state = createInitialGameState(balance, 5606);
    const sleep = startSleep(state, balance);

    const previews = buildFoodPreviews(
      state,
      sleep,
      null,
      balance,
    );

    expect(
      previews.every(
        (preview) =>
          preview.lockedReason ===
          'Сначала заверши текущее действие',
      ),
    ).toBe(true);
  });
});


describe('work upgrade access and sleep forecasts', () => {
  it('offers an upgrade even when the shift is closed, but respects cash and transaction locks', () => {
    const state = { ...createInitialGameState(balance, 22), cash: 10000 };
    expect(buildWorkPreviews(state, null, null, balance)[0]!.lockedReason).not.toBeNull();
    expect(buildWorkUpgradePreviews(state, null, null, balance)[0]!.lockedReason).toBeNull();
    expect(buildWorkUpgradePreviews({ ...state, cash: 0 }, null, null, balance)[0]!.lockedReason).toBe('Недостаточно денег');
    expect(buildWorkUpgradePreviews(state, startSleep(state, balance), null, balance)[0]!.lockedReason).not.toBeNull();
    expect(buildWorkUpgradePreviews({ ...state, jobLevels: { ...state.jobLevels, dishes: 3 } }, null, null, balance)[0]!.lockedReason).toBe('Уже улучшено полностью');
  });
  it('shows only the available sleep before Barry and warns of lethal attrition', () => {
    const state = createInitialGameState(balance, 23);
    state.clock.minuteOfDay = 8 * 60 + 30;
    state.needs = { health: 90, satiety: 50, energy: 0, happiness: 50 };
    const summary = buildSleepPreviews(state, null, null, balance)[0]!.summary.join(' ');
    expect(summary).toContain('до 30 мин');
    expect(summary).toContain('энергия +7.1');
    expect(summary).toContain('сытость -2');
    state.needs.health = 0.01; state.needs.satiety = 0;
    expect(buildSleepPreviews(state, null, null, balance)[0]!.summary.join(' ')).toContain('ОПАСНО');
  });
});
