import type { BalanceConfig } from '../../config/balance.schema';
import { getJackpotBiasUpgrade } from './progression';

export interface JackpotBiasDeflector {
  id: string;
  pairIndex: number;
  side: 'left' | 'right';
  x: number;
  y: number;
  length: number;
  thickness: number;
  angleRadians: number;
  restitution: number;
}

export const deriveJackpotBiasGeometry = (
  config: BalanceConfig,
  level: number,
): JackpotBiasDeflector[] => {
  const upgrade = getJackpotBiasUpgrade(config, level);
  if (!upgrade) return [];

  const { centerX } = config.plinko.geometry;

  return upgrade.deflectorPairs.flatMap((pair, pairIndex) => {
    const angle = (pair.angleDegrees * Math.PI) / 180;
    const common = {
      pairIndex,
      y: pair.deflectorY,
      length: pair.length,
      thickness: pair.thickness,
      restitution: pair.restitution,
    };

    return [
      {
        id: `bias:pair-${pairIndex}:left`,
        side: 'left' as const,
        x: centerX - pair.deflectorOffsetX,
        angleRadians: -angle,
        ...common,
      },
      {
        id: `bias:pair-${pairIndex}:right`,
        side: 'right' as const,
        x: centerX + pair.deflectorOffsetX,
        angleRadians: angle,
        ...common,
      },
    ];
  });
};
