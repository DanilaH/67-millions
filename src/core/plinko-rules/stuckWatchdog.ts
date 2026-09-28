import type { BalanceConfig } from '../../config/balance.schema';

export interface WatchdogVelocity {
  x: number;
  y: number;
}

export const isPlinkoBodyTechnicallyStuck = (
  velocityX: number,
  velocityY: number,
  stationaryTicks: number,
  config: BalanceConfig,
): boolean => {
  const watchdog = config.plinko.stuckWatchdog;
  const speedSquared =
    velocityX * velocityX + velocityY * velocityY;

  return (
    stationaryTicks >= watchdog.stationaryTicks &&
    speedSquared <=
      watchdog.speedEpsilon * watchdog.speedEpsilon
  );
};

export const getPlinkoWatchdogVelocity = (
  x: number,
  config: BalanceConfig,
): WatchdogVelocity => {
  const watchdog = config.plinko.stuckWatchdog;
  const direction = x < config.plinko.geometry.centerX ? -1 : 1;

  return {
    x: direction * watchdog.horizontalVelocity,
    y: watchdog.downwardVelocity,
  };
};
