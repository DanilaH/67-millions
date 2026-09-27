import type { BalanceConfig } from '../../config/balance.schema';

export interface PlinkoPoint {
  x: number;
  y: number;
}

export interface PlinkoBoardLayout {
  pegs: PlinkoPoint[];
  sideGuardPegs: PlinkoPoint[];
  pocketCenters: PlinkoPoint[];
  leftWallX: number;
  rightWallX: number;
  pocketTopY: number;
  pocketBottomY: number;
}

export const deriveBarePlinkoLayout = (
  config: BalanceConfig,
): PlinkoBoardLayout => {
  const geometry = config.plinko.geometry;
  const rows = config.plinko.rows;
  const pegs: PlinkoPoint[] = [];
  const sideGuardPegs: PlinkoPoint[] = [];

  for (let row = 0; row < rows; row += 1) {
    const count = row + 1;
    const y = geometry.topPegY + row * geometry.verticalPegSpacing;
    const rowWidth = (count - 1) * geometry.horizontalPegSpacing;
    const startX = geometry.centerX - rowWidth / 2;

    for (let column = 0; column < count; column += 1) {
      pegs.push({
        x: startX + column * geometry.horizontalPegSpacing,
        y,
      });
    }

    if (row < rows - 1) {
      const halfStepX = geometry.horizontalPegSpacing / 2;
      const halfStepY = geometry.verticalPegSpacing / 2;
      sideGuardPegs.push(
        {
          x: startX - halfStepX,
          y: y + halfStepY,
        },
        {
          x: startX + rowWidth + halfStepX,
          y: y + halfStepY,
        },
      );
    }
  }

  const pocketCount = rows + 1;
  const pocketRowWidth = (pocketCount - 1) * geometry.pocketCenterSpacing;
  const firstPocketX = geometry.centerX - pocketRowWidth / 2;
  const lastPocketX =
    firstPocketX + (pocketCount - 1) * geometry.pocketCenterSpacing;
  const leftWallX = firstPocketX - geometry.pocketCenterSpacing / 2;
  const rightWallX = lastPocketX + geometry.pocketCenterSpacing / 2;
  const pocketTopY =
    geometry.topPegY +
    (rows - 1) * geometry.verticalPegSpacing +
    geometry.verticalPegSpacing;
  const pocketBottomY =
    geometry.topPegY + geometry.boardAreaHeight - geometry.ballRadius * 2;

  return {
    pegs,
    sideGuardPegs,
    pocketCenters: Array.from({ length: pocketCount }, (_, index) => ({
      x: firstPocketX + index * geometry.pocketCenterSpacing,
      y: pocketBottomY,
    })),
    leftWallX,
    rightWallX,
    pocketTopY,
    pocketBottomY,
  };
};

export const getSpawnX = (
  config: BalanceConfig,
  randomSample: number,
): number => {
  if (!Number.isFinite(randomSample) || randomSample < 0 || randomSample >= 1) {
    throw new RangeError('randomSample must be within [0, 1)');
  }

  const jitter = config.plinko.geometry.spawnHorizontalJitterPx;
  return config.plinko.geometry.centerX + (randomSample * 2 - 1) * jitter;
};
