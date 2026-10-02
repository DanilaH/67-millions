import type { BalanceConfig } from '../../config/balance.schema';
import { SeededRandom } from '../../core/rng/SeededRandom';

export type CourierResult = 'SUCCESS' | 'FAILURE' | null;

export interface CourierPoint {
  x: number;
  y: number;
}

export interface CourierObstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CourierSession {
  seed: number;
  position: CourierPoint;
  nextRouteIndex: number;
  start: CourierPoint;
  finish: CourierPoint;
  startRadius: number;
  finishRadius: number;
  routeThickness: number;
  obstacles: CourierObstacle[];
  route: CourierPoint[];
  redrawsRemaining: number;
  started: boolean;
  result: CourierResult;
  failureReason: string | null;
}

export const COURIER_INTERACTION = {
  map: {
    left: 120,
    top: 120,
    right: 1160,
    bottom: 610,
  },
  start: { x: 180, y: 365 },
  finish: { x: 1100, y: 365 },
  startRadius: 62,
  finishRadius: 72,
  routeThickness: 18,
  courierHalfSize: 29,
  speedPixelsPerSecond: 240,
  obstacleWidth: 120,
  obstacleHeight: 115,
  obstacleColumns: [390, 610, 830],
  obstacleYMin: 180,
  obstacleYMax: 500,
  obstacleClearanceFromEndpoints: 100,
} as const;

const getNumber = (
  value: string | number | boolean | undefined,
  key: string,
): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid courier minigame config: ${key}`);
  }
  return value;
};

export const getCourierRules = (
  config: BalanceConfig,
): {
  obstacleCountMin: number;
  obstacleCountMax: number;
  redrawsBeforeStart: number;
} => {
  const minigame = config.work.jobs.courier.minigame;
  const obstacleCountMin = getNumber(
    minigame.obstacleCountMin,
    'obstacleCountMin',
  );
  const obstacleCountMax = getNumber(
    minigame.obstacleCountMax,
    'obstacleCountMax',
  );
  const redrawsBeforeStart = getNumber(
    minigame.redrawsBeforeStart,
    'redrawsBeforeStart',
  );

  if (
    !Number.isInteger(obstacleCountMin) ||
    !Number.isInteger(obstacleCountMax) ||
    obstacleCountMin < 0 ||
    obstacleCountMax < obstacleCountMin
  ) {
    throw new RangeError(
      'Courier obstacle count range must be valid integers',
    );
  }
  if (
    !Number.isInteger(redrawsBeforeStart) ||
    redrawsBeforeStart < 0
  ) {
    throw new RangeError(
      'Courier redrawsBeforeStart must be a non-negative integer',
    );
  }

  return {
    obstacleCountMin,
    obstacleCountMax,
    redrawsBeforeStart,
  };
};

const createObstacles = (
  config: BalanceConfig,
  seed: number,
): CourierObstacle[] => {
  const rules = getCourierRules(config);
  const rng = new SeededRandom(seed);
  const count =
    rules.obstacleCountMin +
    Math.floor(
      rng.next() *
        (rules.obstacleCountMax - rules.obstacleCountMin + 1),
    );

  const columns = [...COURIER_INTERACTION.obstacleColumns];
  const obstacles: CourierObstacle[] = [];

  for (let index = 0; index < count; index += 1) {
    const columnIndex = index % columns.length;
    const x = columns[columnIndex]!;
    let y =
      COURIER_INTERACTION.obstacleYMin +
      rng.next() *
        (COURIER_INTERACTION.obstacleYMax -
          COURIER_INTERACTION.obstacleYMin);

    const previousInColumn = obstacles.find(obstacle => obstacle.x === x);
    if (previousInColumn && Math.abs(y - previousInColumn.y) < COURIER_INTERACTION.obstacleHeight + 16) {
      // Keep the optional fourth crate distinct instead of stacking two sprites.
      const gap = COURIER_INTERACTION.obstacleHeight + 16;
      y = previousInColumn.y + gap <= COURIER_INTERACTION.obstacleYMax
        ? previousInColumn.y + gap : previousInColumn.y - gap;
    }

    obstacles.push({
      id: `courier-obstacle-${index}`,
      x,
      y,
      width: COURIER_INTERACTION.obstacleWidth,
      height: COURIER_INTERACTION.obstacleHeight,
    });
  }

  return obstacles;
};

export const createCourierSession = (
  config: BalanceConfig,
  seed: number,
): CourierSession => {
  if (!Number.isInteger(seed) || seed <= 0) {
    throw new RangeError(
      'Courier seed must be a positive integer',
    );
  }

  const rules = getCourierRules(config);

  return {
    seed,
    position: { ...COURIER_INTERACTION.start },
    nextRouteIndex: 1,
    start: { ...COURIER_INTERACTION.start },
    finish: { ...COURIER_INTERACTION.finish },
    startRadius: COURIER_INTERACTION.startRadius,
    finishRadius: COURIER_INTERACTION.finishRadius,
    routeThickness: COURIER_INTERACTION.routeThickness,
    obstacles: createObstacles(config, seed),
    route: [],
    redrawsRemaining: rules.redrawsBeforeStart,
    started: false,
    result: null,
    failureReason: null,
  };
};

const distanceSquared = (
  left: CourierPoint,
  right: CourierPoint,
): number => {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
};

export const canBeginCourierRoute = (
  session: CourierSession,
  point: CourierPoint,
): boolean =>
  !session.started &&
  session.result === null &&
  distanceSquared(session.start, point) <=
    session.startRadius * session.startRadius;

export const appendCourierRoutePoint = (
  session: CourierSession,
  point: CourierPoint,
): CourierSession => {
  if (session.started || session.result !== null) return session;

  if (
    !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
    point.x < COURIER_INTERACTION.map.left ||
    point.x > COURIER_INTERACTION.map.right ||
    point.y < COURIER_INTERACTION.map.top ||
    point.y > COURIER_INTERACTION.map.bottom
  ) {
    return session;
  }

  if (
    session.route.length === 0 &&
    !canBeginCourierRoute(session, point)
  ) {
    return session;
  }

  const previous = session.route.at(-1);
  if (
    previous !== undefined &&
    distanceSquared(previous, point) < 9
  ) {
    return session;
  }

  return {
    ...session,
    route: session.route.length === 0
      ? distanceSquared(session.start, point) < 9
        ? [{ ...session.start }]
        : [{ ...session.start }, { ...point }]
      : [...session.route, { ...point }],
  };
};

export const redrawCourierRoute = (
  session: CourierSession,
): CourierSession => {
  if (
    session.started ||
    session.result !== null ||
    session.redrawsRemaining <= 0 ||
    session.route.length === 0
  ) {
    return session;
  }

  return {
    ...session,
    route: [],
    redrawsRemaining: session.redrawsRemaining - 1,
  };
};

// Swept square collider matches the 58 × 58 courier sprite. Slab clipping
// returns the first contact, including at low FPS; disjoint collinear edges
// cannot produce the false collisions of the previous orientation test.
const contactFraction = (
  start: CourierPoint, end: CourierPoint, obstacle: CourierObstacle,
): number | null => {
  let enter = 0;
  let exit = 1;
  for (const axis of ['x', 'y'] as const) {
    const half = (axis === 'x' ? obstacle.width : obstacle.height) / 2
      + COURIER_INTERACTION.courierHalfSize;
    const low = obstacle[axis] - half;
    const high = obstacle[axis] + half;
    const delta = end[axis] - start[axis];
    if (delta === 0) {
      if (start[axis] < low || start[axis] > high) return null;
    } else {
      const a = (low - start[axis]) / delta;
      const b = (high - start[axis]) / delta;
      enter = Math.max(enter, Math.min(a, b));
      exit = Math.min(exit, Math.max(a, b));
      if (enter > exit) return null;
    }
  }
  return enter;
};

export const startCourierDelivery = (session: CourierSession): CourierSession => {
  if (session.started || session.result !== null || session.route.length < 2) return session;
  const route = [...session.route];
  const last = route.at(-1)!;
  // Snap a route ending in the delivery zone to its visible destination.
  if (distanceSquared(last, session.finish) <= session.finishRadius ** 2 &&
      distanceSquared(last, session.finish) > 0) route.push({ ...session.finish });
  return { ...session, started: true, route, position: { ...session.start }, nextRouteIndex: 1 };
};

export const advanceCourierSession = (
  session: CourierSession, deltaMs: number,
): CourierSession => {
  if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new RangeError('Courier deltaMs must be finite and non-negative');
  if (!session.started || session.result !== null || deltaMs === 0) return session;
  let remaining = deltaMs * COURIER_INTERACTION.speedPixelsPerSecond / 1000;
  let position = { ...session.position };
  let index = session.nextRouteIndex;
  while (index < session.route.length) {
    const target = session.route[index]!;
    const distance = Math.sqrt(distanceSquared(position, target));
    const travel = Math.min(distance, remaining);
    const end = distance === 0 ? target : {
      x: position.x + (target.x - position.x) * travel / distance,
      y: position.y + (target.y - position.y) * travel / distance,
    };
    let contact: number | null = null;
    for (const obstacle of session.obstacles) {
      const t = contactFraction(position, end, obstacle);
      if (t !== null && (contact === null || t < contact)) contact = t;
    }
    if (contact !== null) return {
      ...session, nextRouteIndex: index,
      position: { x: position.x + (end.x - position.x) * contact, y: position.y + (end.y - position.y) * contact },
      result: 'FAILURE', failureReason: 'Курьер врезался в препятствие',
    };
    position = { ...end };
    remaining -= travel;
    if (travel < distance) break;
    index += 1;
    if (remaining <= 0 && index < session.route.length) break;
  }
  const next = { ...session, position, nextRouteIndex: index };
  if (index < session.route.length) return next;
  const arrived = distanceSquared(position, session.finish) < 0.000001;
  return { ...next, result: arrived ? 'SUCCESS' : 'FAILURE',
    failureReason: arrived ? null : 'Маршрут закончился до точки доставки' };
};

// Offline simulation for deterministic balance/integration tests only.
export const resolveCourierRoute = (session: CourierSession): CourierSession =>
  advanceCourierSession(startCourierDelivery(session), Number.MAX_SAFE_INTEGER);
