import type { BalanceConfig } from '../../config/balance.schema';

export type DishesResult = 'SUCCESS' | 'FAILURE' | null;

export interface DishesPoint {
  x: number;
  y: number;
}

export interface DishesDirtSpot extends DishesPoint {
  id: string;
  plateIndex: number;
  cleaned: boolean;
}

export interface DishesPlate {
  x: number;
  y: number;
  radius: number;
}

export interface DishesSession {
  durationMs: number;
  elapsedMs: number;
  successCleanPercent: number;
  scrubRadius: number;
  plates: DishesPlate[];
  spots: DishesDirtSpot[];
  result: DishesResult;
}

export const DISHES_INTERACTION = {
  plateRadius: 74,
  scrubRadius: 34,
  dirtCellSize: 3,
  dirtRadiusRatio: 0.82,
  plates: [
    { x: 330, y: 250 },
    { x: 640, y: 250 },
    { x: 950, y: 250 },
    { x: 485, y: 500 },
    { x: 795, y: 500 },
  ],
} as const;

const getNumber = (
  value: string | number | boolean | undefined,
  key: string,
): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid dishes minigame config: ${key}`);
  }
  return value;
};

export const getDishesRules = (
  config: BalanceConfig,
): {
  timerRealSeconds: number;
  successCleanPercent: number;
} => {
  const minigame = config.work.jobs.dishes.minigame;
  const timerRealSeconds = getNumber(
    minigame.timerRealSeconds,
    'timerRealSeconds',
  );
  const successCleanPercent = getNumber(
    minigame.successCleanPercent,
    'successCleanPercent',
  );

  if (timerRealSeconds <= 0) {
    throw new RangeError('Dishes timer must be positive');
  }
  if (successCleanPercent <= 0 || successCleanPercent > 1) {
    throw new RangeError(
      'Dishes successCleanPercent must be within (0, 1]',
    );
  }

  return { timerRealSeconds, successCleanPercent };
};

const createSpotsForPlate = (
  plate: DishesPlate,
  plateIndex: number,
): DishesDirtSpot[] => {
  const spots: DishesDirtSpot[] = [];
  const size = DISHES_INTERACTION.dirtCellSize;
  const radius = Math.floor(plate.radius * DISHES_INTERACTION.dirtRadiusRatio);
  // Uniform area samples, also used as the rendered alpha mask. Coverage is
  // erased surface area, not a count of scattered dirt targets.
  for (let y = -radius + size / 2; y < radius; y += size) {
    for (let x = -radius + size / 2; x < radius; x += size) {
      if (x * x + y * y > radius * radius) continue;
      spots.push({ id: `plate-${plateIndex}-cell-${spots.length}`, plateIndex,
        x: plate.x + x, y: plate.y + y, cleaned: false });
    }
  }

  return spots;
};

export const createDishesSession = (
  config: BalanceConfig,
): DishesSession => {
  const rules = getDishesRules(config);
  const plates = DISHES_INTERACTION.plates.map((plate) => ({
    ...plate,
    radius: DISHES_INTERACTION.plateRadius,
  }));

  return {
    durationMs: rules.timerRealSeconds * 1000,
    elapsedMs: 0,
    successCleanPercent: rules.successCleanPercent,
    scrubRadius: DISHES_INTERACTION.scrubRadius,
    plates,
    spots: plates.flatMap(createSpotsForPlate),
    result: null,
  };
};

export const getDishesCleanPercent = (
  session: DishesSession,
): number => {
  if (session.spots.length === 0) return 1;
  const cleaned = session.spots.filter((spot) => spot.cleaned).length;
  return cleaned / session.spots.length;
};

export const getDishesCleanPlateCount = (session: DishesSession): number => {
  const total = session.plates.map(() => 0);
  const clean = session.plates.map(() => 0);
  for (const spot of session.spots) {
    total[spot.plateIndex]!++;
    if (spot.cleaned) clean[spot.plateIndex]!++;
  }
  return total.filter((count, i) => count === 0 || clean[i]! / count >= session.successCleanPercent).length;
};

const distanceSquared = (
  left: DishesPoint,
  right: DishesPoint,
): number => {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
};

const distanceToSegmentSquared = (
  point: DishesPoint,
  start: DishesPoint,
  end: DishesPoint,
): number => {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSquared =
    segmentX * segmentX + segmentY * segmentY;

  if (lengthSquared === 0) {
    return distanceSquared(point, start);
  }

  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * segmentX +
        (point.y - start.y) * segmentY) /
        lengthSquared,
    ),
  );
  const nearest = {
    x: start.x + segmentX * projection,
    y: start.y + segmentY * projection,
  };
  return distanceSquared(point, nearest);
};

const finishIfThresholdReached = (
  session: DishesSession,
): DishesSession =>
  session.result === null &&
  getDishesCleanPlateCount(session) === session.plates.length
    ? { ...session, result: 'SUCCESS' }
    : session;

export const scrubDishes = (
  session: DishesSession,
  start: DishesPoint,
  end: DishesPoint,
): DishesSession => {
  if (session.result !== null) return session;
  if (![start.x, start.y, end.x, end.y].every(Number.isFinite)) return session;

  const radiusSquared = session.scrubRadius * session.scrubRadius;
  let changed = false;
  const spots = session.spots.map((spot) => {
    if (
      spot.cleaned ||
      distanceToSegmentSquared(spot, start, end) > radiusSquared
    ) {
      return spot;
    }

    changed = true;
    return { ...spot, cleaned: true };
  });

  if (!changed) return session;

  return finishIfThresholdReached({
    ...session,
    spots,
  });
};

export const advanceDishesSession = (
  session: DishesSession,
  deltaMs: number,
): DishesSession => {
  if (!Number.isFinite(deltaMs) || deltaMs < 0) {
    throw new RangeError('Dishes deltaMs must be finite and non-negative');
  }
  if (session.result !== null || deltaMs === 0) return session;

  const elapsedMs = Math.min(
    session.durationMs,
    session.elapsedMs + deltaMs,
  );

  if (elapsedMs < session.durationMs) {
    return { ...session, elapsedMs };
  }

  const completed = { ...session, elapsedMs };
  return {
    ...completed,
    result:
      getDishesCleanPlateCount(completed) === completed.plates.length
        ? 'SUCCESS'
        : 'FAILURE',
  };
};

export const getDishesRemainingMs = (
  session: DishesSession,
): number =>
  Math.max(0, session.durationMs - session.elapsedMs);
