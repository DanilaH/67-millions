import type { BalanceConfig } from '../../config/balance.schema';
import { getJackpotBiasUpgrade } from './progression';

export interface JackpotBiasBumper {
  id: 'bias:left' | 'bias:right';
  x: number;
  y: number;
  radius: number;
  restitution: number;
}

export const deriveJackpotBiasGeometry = (
  config: BalanceConfig,
  level: number,
): JackpotBiasBumper[] => {
  const upgrade = getJackpotBiasUpgrade(config, level);
  if (!upgrade) return [];

  const { centerX } = config.plinko.geometry;
  const common = {
    y: upgrade.bumperY,
    radius: upgrade.bumperRadius,
    restitution: upgrade.restitution,
  };

  return [
    {
      id: 'bias:left',
      x: centerX - upgrade.bumperOffsetX,
      ...common,
    },
    {
      id: 'bias:right',
      x: centerX + upgrade.bumperOffsetX,
      ...common,
    },
  ];
};
