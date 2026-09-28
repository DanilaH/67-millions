import type { BalanceConfig } from '../../config/balance.schema';
import { getJackpotBiasUpgrade } from './progression';

export interface JackpotBiasDeflector {
  id: 'bias:left' | 'bias:right';
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
  const angle = (upgrade.angleDegrees * Math.PI) / 180;
  const common = {
    y: upgrade.deflectorY,
    length: upgrade.length,
    thickness: upgrade.thickness,
    restitution: upgrade.restitution,
  };

  return [
    {
      id: 'bias:left',
      x: centerX - upgrade.deflectorOffsetX,
      angleRadians: -angle,
      ...common,
    },
    {
      id: 'bias:right',
      x: centerX + upgrade.deflectorOffsetX,
      angleRadians: angle,
      ...common,
    },
  ];
};
