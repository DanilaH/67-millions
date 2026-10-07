import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import {
  advanceDishesSession,
  createDishesSession,
  getDishesCleanPercent,
  getDishesCleanPlateCount,
  getDishesRemainingMs,
  getDishesRules,
  scrubDishes,
} from '../src/minigames/dishes/dishesModel';

describe('Dishes minigame model', () => {
  it('uses the canonical 20-second / 90%-clean rules', () => {
    expect(getDishesRules(balance)).toEqual({
      timerRealSeconds: 20,
      successCleanPercent: 0.9,
    });

    const session = createDishesSession(balance);
    expect(session.durationMs).toBe(20_000);
    expect(session.successCleanPercent).toBe(0.9);
    expect(session.spots.length).toBeGreaterThan(5000);
    expect(getDishesCleanPercent(session)).toBe(0);
  });

  it('treats a continuous pointer segment as a forgiving scrub path', () => {
    const session = createDishesSession(balance);
    const spot = session.spots[0]!;

    const scrubbed = scrubDishes(
      session,
      {
        x: spot.x - session.scrubRadius + 2,
        y: spot.y + session.scrubRadius - 4,
      },
      {
        x: spot.x + session.scrubRadius - 2,
        y: spot.y - session.scrubRadius + 4,
      },
    );

    expect(scrubbed.spots[0]?.cleaned).toBe(true);
    expect(getDishesCleanPercent(scrubbed)).toBeGreaterThan(0);
  });

  it('reaches SUCCESS as soon as every plate reaches 90%', () => {
    let session = createDishesSession(balance);
    const needed = session.spots.length;

    for (const spot of session.spots.slice(0, needed)) {
      session = scrubDishes(
        session,
        { x: spot.x, y: spot.y },
        { x: spot.x, y: spot.y },
      );
    }

    expect(getDishesCleanPercent(session)).toBeGreaterThanOrEqual(0.9);
    expect(session.result).toBe('SUCCESS');
    expect(session.elapsedMs).toBe(0);
  });

  it('fails exactly at the 20-second deadline when below threshold', () => {
    let session = createDishesSession(balance);

    session = advanceDishesSession(session, 19_999);
    expect(session.result).toBeNull();
    expect(getDishesRemainingMs(session)).toBe(1);

    session = advanceDishesSession(session, 1);
    expect(session.elapsedMs).toBe(20_000);
    expect(session.result).toBe('FAILURE');
    expect(getDishesRemainingMs(session)).toBe(0);
  });

  it('ignores further time and scrub input after completion', () => {
    let session = createDishesSession(balance);
    session = advanceDishesSession(session, 20_000);
    expect(session.result).toBe('FAILURE');

    const afterTime = advanceDishesSession(session, 5_000);
    const afterScrub = scrubDishes(
      afterTime,
      { x: 0, y: 0 },
      { x: 1280, y: 720 },
    );

    expect(afterScrub).toEqual(session);
  });
});

describe('Dishes surface eraser regressions', () => {
  it('clears only the touched area and keeps the original session immutable', () => {
    const initial = createDishesSession(balance);
    const plate = initial.plates[0]!;
    const scrubbed = scrubDishes(initial, plate, plate);
    expect(getDishesCleanPercent(initial)).toBe(0);
    // One central brush footprint is about 6% of five whole dirty surfaces.
    expect(getDishesCleanPercent(scrubbed)).toBeGreaterThan(0.05);
    expect(getDishesCleanPercent(scrubbed)).toBeLessThan(0.08);
    expect(scrubDishes(scrubbed, plate, plate)).toBe(scrubbed);
    expect(scrubDishes(initial, { x: NaN, y: 0 }, plate)).toBe(initial);
  });

  it('erases the same continuous strip for sparse and dense pointer events', () => {
    const initial = createDishesSession(balance);
    const start = { x: 250, y: 250 }, end = { x: 420, y: 250 };
    const sparse = scrubDishes(initial, start, end);
    let dense = initial;
    for (let x = start.x; x < end.x; x += 10) dense = scrubDishes(dense, { x, y: 250 }, { x: x + 10, y: 250 });
    expect(dense.spots).toEqual(sparse.spots);
    expect(dense.result).toBeNull();
  });
});


it('does not let four clean plates compensate for a half-dirty fifth', () => {
  const s = createDishesSession(balance);
  const spots = s.spots.map((spot, i) => ({ ...spot, cleaned: spot.plateIndex !== 0 || i % 2 === 0 }));
  const partial = { ...s, spots };
  expect(getDishesCleanPercent(partial)).toBeGreaterThanOrEqual(0.9);
  expect(getDishesCleanPlateCount(partial)).toBe(4);
  expect(advanceDishesSession(partial, s.durationMs).result).toBe('FAILURE');
  expect(scrubDishes(partial, s.plates[1]!, s.plates[1]!).result).toBeNull();
});
