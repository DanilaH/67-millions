import type { BalanceConfig } from '../../config/balance.schema';

export interface ReturnTarget {
  x: number;
  y: number;
}

export const getReturnTarget = (
  config: BalanceConfig,
  currentX: number,
): ReturnTarget => {
  if (!Number.isFinite(currentX)) {
    throw new TypeError('Return currentX must be finite');
  }

  const geometry = config.plinko.geometry;
  const retention = config.plinko.returnPhysics.horizontalRetention;

  return {
    x:
      geometry.centerX +
      (currentX - geometry.centerX) * retention,
    y: geometry.topPegY - geometry.verticalPegSpacing,
  };
};
