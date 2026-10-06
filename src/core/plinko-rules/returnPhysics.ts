import type { BalanceConfig } from '../../config/balance.schema';

export interface ReturnTarget {
  x: number;
  y: number;
}

export const getReturnTarget = (
  config: BalanceConfig,
  currentX: number,
  returnLevel: number,
): ReturnTarget => {
  if (!Number.isFinite(currentX)) {
    throw new TypeError('Return currentX must be finite');
  }

  if (!Number.isInteger(returnLevel) || returnLevel < 1 || returnLevel > 4) {
    throw new RangeError('Return level must be between 1 and 4');
  }

  const geometry = config.plinko.geometry;
  const retention = config.plinko.returnPhysics.horizontalRetentionByLevel?.[returnLevel - 1]
    ?? config.plinko.returnPhysics.horizontalRetention;

  return {
    x:
      geometry.centerX +
      (currentX - geometry.centerX) * retention,
    y: geometry.topPegY - geometry.verticalPegSpacing,
  };
};
