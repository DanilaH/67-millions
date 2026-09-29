import type { BalanceConfig } from '../../config/balance.schema';

export type TrashResult = 'SUCCESS' | 'FAILURE' | null;

export interface TrashPoint {
  x: number;
  y: number;
}

export interface TrashBag extends TrashPoint {
  id: string;
  accepted: boolean;
}

export interface TrashTarget {
  x: number;
  y: number;
  width: number;
  height: number;
  forgivingMargin: number;
}

export interface TrashSession {
  durationMs: number;
  elapsedMs: number;
  grabRadius: number;
  target: TrashTarget;
  bags: TrashBag[];
  result: TrashResult;
}

export const TRASH_INTERACTION = {
  grabRadius: 58,
  target: {
    x: 880,
    y: 185,
    width: 300,
    height: 350,
    forgivingMargin: 42,
  },
  bagPositions: [
    { x: 220, y: 180 },
    { x: 390, y: 180 },
    { x: 260, y: 360 },
    { x: 450, y: 385 },
    { x: 335, y: 550 },
  ],
} as const;

const getNumber = (
  value: string | number | boolean | undefined,
  key: string,
): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid trash minigame config: ${key}`);
  }
  return value;
};

export const getTrashRules = (
  config: BalanceConfig,
): {
  timerRealSeconds: number;
  bagCount: number;
} => {
  const minigame = config.work.jobs.trash.minigame;
  const timerRealSeconds = getNumber(
    minigame.timerRealSeconds,
    'timerRealSeconds',
  );
  const bagCount = getNumber(
    minigame.bagCount,
    'bagCount',
  );

  if (timerRealSeconds <= 0) {
    throw new RangeError('Trash timer must be positive');
  }
  if (!Number.isInteger(bagCount) || bagCount <= 0) {
    throw new RangeError('Trash bagCount must be a positive integer');
  }
  if (bagCount > TRASH_INTERACTION.bagPositions.length) {
    throw new RangeError(
      'Trash bagCount exceeds deterministic layout capacity',
    );
  }

  return { timerRealSeconds, bagCount };
};

export const createTrashSession = (
  config: BalanceConfig,
): TrashSession => {
  const rules = getTrashRules(config);

  return {
    durationMs: rules.timerRealSeconds * 1000,
    elapsedMs: 0,
    grabRadius: TRASH_INTERACTION.grabRadius,
    target: { ...TRASH_INTERACTION.target },
    bags: TRASH_INTERACTION.bagPositions
      .slice(0, rules.bagCount)
      .map((point, index) => ({
        id: `trash-bag-${index}`,
        ...point,
        accepted: false,
      })),
    result: null,
  };
};

export const getAcceptedTrashBagCount = (
  session: TrashSession,
): number =>
  session.bags.filter((bag) => bag.accepted).length;

export const getTrashRemainingMs = (
  session: TrashSession,
): number =>
  Math.max(0, session.durationMs - session.elapsedMs);

const distanceSquared = (
  left: TrashPoint,
  right: TrashPoint,
): number => {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
};

export const findTrashBagAtPoint = (
  session: TrashSession,
  point: TrashPoint,
): string | null => {
  if (session.result !== null) return null;

  const radiusSquared = session.grabRadius * session.grabRadius;
  const candidates = session.bags
    .filter(
      (bag) =>
        !bag.accepted &&
        distanceSquared(bag, point) <= radiusSquared,
    )
    .sort(
      (left, right) =>
        distanceSquared(left, point) -
        distanceSquared(right, point),
    );

  return candidates[0]?.id ?? null;
};

export const moveTrashBag = (
  session: TrashSession,
  bagId: string,
  point: TrashPoint,
): TrashSession => {
  if (session.result !== null) return session;

  let changed = false;
  const bags = session.bags.map((bag) => {
    if (bag.id !== bagId || bag.accepted) return bag;

    changed = true;
    return {
      ...bag,
      x: point.x,
      y: point.y,
    };
  });

  return changed ? { ...session, bags } : session;
};

export const isTrashTargetAcceptingPoint = (
  session: TrashSession,
  point: TrashPoint,
): boolean => {
  const margin = session.target.forgivingMargin;
  const left = session.target.x - margin;
  const right =
    session.target.x + session.target.width + margin;
  const top = session.target.y - margin;
  const bottom =
    session.target.y + session.target.height + margin;

  return (
    point.x >= left &&
    point.x <= right &&
    point.y >= top &&
    point.y <= bottom
  );
};

export const dropTrashBag = (
  session: TrashSession,
  bagId: string,
  point: TrashPoint,
): TrashSession => {
  if (session.result !== null) return session;
  if (!isTrashTargetAcceptingPoint(session, point)) {
    return moveTrashBag(session, bagId, point);
  }

  let accepted = false;
  const bags = session.bags.map((bag) => {
    if (bag.id !== bagId || bag.accepted) return bag;

    accepted = true;
    return {
      ...bag,
      x: point.x,
      y: point.y,
      accepted: true,
    };
  });

  if (!accepted) return session;

  const next: TrashSession = {
    ...session,
    bags,
  };

  return getAcceptedTrashBagCount(next) === next.bags.length
    ? { ...next, result: 'SUCCESS' }
    : next;
};

export const advanceTrashSession = (
  session: TrashSession,
  deltaMs: number,
): TrashSession => {
  if (!Number.isFinite(deltaMs) || deltaMs < 0) {
    throw new RangeError(
      'Trash deltaMs must be finite and non-negative',
    );
  }
  if (session.result !== null || deltaMs === 0) return session;

  const elapsedMs = Math.min(
    session.durationMs,
    session.elapsedMs + deltaMs,
  );

  if (elapsedMs < session.durationMs) {
    return { ...session, elapsedMs };
  }

  return {
    ...session,
    elapsedMs,
    result:
      getAcceptedTrashBagCount(session) === session.bags.length
        ? 'SUCCESS'
        : 'FAILURE',
  };
};
