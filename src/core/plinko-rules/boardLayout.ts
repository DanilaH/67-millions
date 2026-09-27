import type { BalanceConfig } from '../../config/balance.schema';

export interface PlinkoPoint {
  x: number;
  y: number;
}

export interface PlinkoGuide {
  center: PlinkoPoint;
  length: number;
  angle: number;
}

export interface PlinkoBoardLayout {
  pegs: PlinkoPoint[];
  pocketCenters: PlinkoPoint[];
  sideGuides: [PlinkoGuide, PlinkoGuide];
  leftWallX: number;
  rightWallX: number;
  pocketTopY: number;
  pocketBottomY: number;
}

const deriveGuide = (
  start: PlinkoPoint,
  end: PlinkoPoint,
): PlinkoGuide => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  return {
    center: {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    },
    length: Math.hypot(dx, dy),
    angle: Math.atan2(dy, dx),
  };
};

export const deriveBarePlinkoLayout = (
  config: BalanceConfig,
): PlinkoBoardLayout => {
  const geometry = config.plinko.geometry;
  const rows = config.plinko.rows;
  const pegs: PlinkoPoint[] = [];

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
  }

  const pocketCount = rows + 1;
  const pocketRowWidth = (pocketCount - 1) * geometry.pocketCenterSpacing;
  const firstPocketX = geometry.centerX - pocketRowWidth / 2;
  const lastPocketX = firstPocketX + (pocketCount - 1) * geometry.pocketCenterSpacing;
  const leftWallX = firstPocketX - geometry.pocketCenterSpacing / 2;
  const rightWallX = lastPocketX + geometry.pocketCenterSpacing / 2;
  const pocketTopY =
    geometry.topPegY +
    (rows - 1) * geometry.verticalPegSpacing +
    geometry.verticalPegSpacing;
  const pocketBottomY =
    geometry.topPegY + geometry.boardAreaHeight - geometry.ballRadius * 2;

  const guideTopOffset = geometry.horizontalPegSpacing;
  const lastPegRowY =
    geometry.topPegY + (rows - 1) * geometry.verticalPegSpacing;
  const leftGuide = deriveGuide(
    {
      x: geometry.centerX - guideTopOffset,
      y: geometry.topPegY,
    },
    {
      x: leftWallX,
      y: lastPegRowY,
    },
  );
  const rightGuide = deriveGuide(
    {
      x: geometry.centerX + guideTopOffset,
      y: geometry.topPegY,
    },
    {
      x: rightWallX,
      y: lastPegRowY,
    },
  );

  return {
    pegs,
    pocketCenters: Array.from({ length: pocketCount }, (_, index) => ({
      x: firstPocketX + index * geometry.pocketCenterSpacing,
      y: pocketBottomY,
    })),
    sideGuides: [leftGuide, rightGuide],
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
