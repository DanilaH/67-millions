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
    const y =
      COURIER_INTERACTION.obstacleYMin +
      rng.next() *
        (COURIER_INTERACTION.obstacleYMax -
          COURIER_INTERACTION.obstacleYMin);

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
    route: [...session.route, { ...point }],
  };
};

export const redrawCourierRoute = (
  session: CourierSession,
): CourierSession => {
  if (
    session.started ||
    session.result !== null ||
    session.redrawsRemaining <= 0
  ) {
    return session;
  }

  return {
    ...session,
    route: [],
    redrawsRemaining: session.redrawsRemaining - 1,
  };
};

const pointInsideExpandedObstacle = (
  point: CourierPoint,
  obstacle: CourierObstacle,
  padding: number,
): boolean =>
  point.x >= obstacle.x - obstacle.width / 2 - padding &&
  point.x <= obstacle.x + obstacle.width / 2 + padding &&
  point.y >= obstacle.y - obstacle.height / 2 - padding &&
  point.y <= obstacle.y + obstacle.height / 2 + padding;

const segmentIntersectsExpandedRect = (
  start: CourierPoint,
  end: CourierPoint,
  obstacle: CourierObstacle,
  padding: number,
): boolean => {
  if (
    pointInsideExpandedObstacle(start, obstacle, padding) ||
    pointInsideExpandedObstacle(end, obstacle, padding)
  ) {
    return true;
  }

  const left =
    obstacle.x - obstacle.width / 2 - padding;
  const right =
    obstacle.x + obstacle.width / 2 + padding;
  const top =
    obstacle.y - obstacle.height / 2 - padding;
  const bottom =
    obstacle.y + obstacle.height / 2 + padding;

  const edges: Array<[CourierPoint, CourierPoint]> = [
    [{ x: left, y: top }, { x: right, y: top }],
    [{ x: right, y: top }, { x: right, y: bottom }],
    [{ x: right, y: bottom }, { x: left, y: bottom }],
    [{ x: left, y: bottom }, { x: left, y: top }],
  ];

  const orientation = (
    a: CourierPoint,
    b: CourierPoint,
    c: CourierPoint,
  ): number =>
    (b.x - a.x) * (c.y - a.y) -
    (b.y - a.y) * (c.x - a.x);

  const intersects = (
    a: CourierPoint,
    b: CourierPoint,
    c: CourierPoint,
    d: CourierPoint,
  ): boolean => {
    const o1 = orientation(a, b, c);
    const o2 = orientation(a, b, d);
    const o3 = orientation(c, d, a);
    const o4 = orientation(c, d, b);

    return (
      ((o1 >= 0 && o2 <= 0) || (o1 <= 0 && o2 >= 0)) &&
      ((o3 >= 0 && o4 <= 0) || (o3 <= 0 && o4 >= 0))
    );
  };

  return edges.some(([a, b]) =>
    intersects(start, end, a, b),
  );
};

export const resolveCourierRoute = (
  session: CourierSession,
): CourierSession => {
  if (session.started || session.result !== null) return session;

  const route = session.route;
  if (route.length < 2) {
    return {
      ...session,
      started: true,
      result: 'FAILURE',
      failureReason: 'Route is missing',
    };
  }

  const first = route[0]!;
  const last = route.at(-1)!;

  if (!canBeginCourierRoute(session, first)) {
    return {
      ...session,
      started: true,
      result: 'FAILURE',
      failureReason: 'Route does not start at pickup',
    };
  }

  if (
    distanceSquared(last, session.finish) >
    session.finishRadius * session.finishRadius
  ) {
    return {
      ...session,
      started: true,
      result: 'FAILURE',
      failureReason: 'Route does not reach destination',
    };
  }

  const padding = session.routeThickness / 2;
  for (let index = 1; index < route.length; index += 1) {
    const start = route[index - 1]!;
    const end = route[index]!;

    if (
      session.obstacles.some((obstacle) =>
        segmentIntersectsExpandedRect(
          start,
          end,
          obstacle,
          padding,
        ),
      )
    ) {
      return {
        ...session,
        started: true,
        result: 'FAILURE',
        failureReason: 'Route intersects an obstacle',
      };
    }
  }

  return {
    ...session,
    started: true,
    result: 'SUCCESS',
    failureReason: null,
  };
};
