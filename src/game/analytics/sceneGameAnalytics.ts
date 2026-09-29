import type Phaser from 'phaser';

import type { GameAnalytics } from '../../analytics/GameAnalytics';

export const GAME_ANALYTICS_REGISTRY_KEY =
  '67m:game-analytics' as const;

export const getSceneGameAnalytics = (
  scene: Phaser.Scene,
): GameAnalytics => {
  const value = scene.game.registry.get(
    GAME_ANALYTICS_REGISTRY_KEY,
  ) as unknown;

  if (!(value instanceof Object)) {
    throw new Error(
      'Game analytics is not registered',
    );
  }

  const analytics = value as GameAnalytics;
  if (
    typeof analytics.track !== 'function' ||
    typeof analytics.observeState !== 'function'
  ) {
    throw new Error(
      'Game analytics registry value is invalid',
    );
  }

  return analytics;
};
