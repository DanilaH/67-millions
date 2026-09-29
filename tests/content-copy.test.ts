import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import { createInitialGameState } from '../src/core/state/GameState';
import {
  buildEntertainmentPreviews,
  buildFoodPreviews,
} from '../src/game/actions/actionPreviews';
import {
  BARRY_CONTENT,
  ENTERTAINMENT_CONTENT,
  EVENT_CONTENT,
  FOOD_CONTENT,
  LOCATION_CONTENT,
} from '../src/game/content/contentCatalog';
import { buildEventPresentation } from '../src/game/events/eventUiModel';
import { deriveMainMapLocations } from '../src/game/map/mainMapModel';

const flattenStrings = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) {
    return value.flatMap(flattenStrings);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap(flattenStrings);
  }
  return [];
};

describe('T060 content copy pass', () => {
  it('covers every configured event, food, entertainment, and Main Map location', () => {
    expect(Object.keys(EVENT_CONTENT).sort()).toEqual(
      balance.events.definitions.map((entry) => entry.id).sort(),
    );
    expect(Object.keys(FOOD_CONTENT).sort()).toEqual(
      balance.food.map((entry) => entry.id).sort(),
    );
    expect(Object.keys(ENTERTAINMENT_CONTENT).sort()).toEqual(
      balance.entertainment.map((entry) => entry.id).sort(),
    );
    expect(Object.keys(LOCATION_CONTENT).sort()).toEqual([
      'casino',
      'dumpster',
      'entertainment',
      'food',
      'home',
      'shower',
      'work',
    ]);
  });

  it('does not expose raw food or entertainment ids as production titles', () => {
    const state = {
      ...createInitialGameState(balance, 1_301),
      cash: 1_000_000,
    };

    const foods = buildFoodPreviews(
      state,
      null,
      null,
      balance,
    );
    const entertainment = buildEntertainmentPreviews(
      state,
      null,
      null,
      balance,
    );

    expect(
      foods.some((preview) => /^FOOD_\d+$/.test(preview.title)),
    ).toBe(false);
    expect(
      entertainment.some((preview) =>
        ['FREE_FUN', 'PC_CLUB', 'CINEMA'].includes(
          preview.title,
        ),
      ),
    ).toBe(false);

    expect(foods).toHaveLength(10);
    expect(entertainment).toHaveLength(3);
  });

  it('uses fictional location copy for all seven zero-time map destinations', () => {
    const locations = deriveMainMapLocations(balance);

    expect(locations).toHaveLength(7);
    expect(
      locations.every(
        (location) => location.timeCostMinutes === 0,
      ),
    ).toBe(true);
    expect(
      locations.map((location) => location.label),
    ).toEqual([
      LOCATION_CONTENT.work.title,
      LOCATION_CONTENT.food.title,
      LOCATION_CONTENT.home.title,
      LOCATION_CONTENT.entertainment.title,
      LOCATION_CONTENT.dumpster.title,
      LOCATION_CONTENT.shower.title,
      LOCATION_CONTENT.casino.title,
    ]);
  });

  it('presents all ten events with readable A/B copy and dynamic pay-choice affordability', () => {
    const rich = {
      ...createInitialGameState(balance, 1_302),
      cash: 100_000,
    };

    for (const definition of balance.events.definitions) {
      const presentation = buildEventPresentation(
        {
          ...rich,
          pendingEventId: definition.id,
        },
        balance,
        definition.id,
      );

      expect(presentation.title).not.toBe(definition.id);
      expect(presentation.body.length).toBeGreaterThan(20);
      expect(presentation.choices).toHaveLength(2);
      expect(presentation.choices[0]?.id).toBe('a');
      expect(presentation.choices[1]?.id).toBe('b');
      expect(
        presentation.choices.every(
          (choice) => choice.label.length > 4,
        ),
      ).toBe(true);
    }

    const poor = {
      ...createInitialGameState(balance, 1_303),
      cash: 0,
      pendingEventId: 'EVENT_03',
    };
    const expensive = buildEventPresentation(
      poor,
      balance,
      'EVENT_03',
    );

    expect(expensive.choices[0]).toMatchObject({
      id: 'a',
      available: false,
      lockedReason: 'НЕ ХВАТАЕТ ДЕНЕГ',
    });
    expect(expensive.choices[1]?.available).toBe(true);
  });

  it('keeps public copy fictional and free of real marketplace or political branding', () => {
    const publicCopy = flattenStrings({
      foods: FOOD_CONTENT,
      entertainment: ENTERTAINMENT_CONTENT,
      locations: LOCATION_CONTENT,
      barry: BARRY_CONTENT,
      events: EVENT_CONTENT,
    }).join('\n');

    const forbidden = [
      'wildberries',
      'ozon',
      'яндекс',
      'yandex',
      'amazon',
      'aliexpress',
      'avito',
      'вконтакте',
      'vk ',
      'telegram',
      'президент',
      'партия единая россия',
      'путин',
      'трамп',
    ];

    for (const marker of forbidden) {
      expect(publicCopy.toLowerCase()).not.toContain(marker);
    }
  });

  it('defines consistent Barry identity and due/fail copy', () => {
    expect(BARRY_CONTENT.name).toBe('Барри Вайлд');
    expect(BARRY_CONTENT.dueBody).toContain('09:00');
    expect(BARRY_CONTENT.paid.length).toBeGreaterThan(20);
    expect(BARRY_CONTENT.failed.length).toBeGreaterThan(20);
  });
});
