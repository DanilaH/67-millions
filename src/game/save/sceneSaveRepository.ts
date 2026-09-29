import type Phaser from 'phaser';

import type { SaveRepository } from '../../core/save/repository';

export const GAME_SAVE_REPOSITORY_REGISTRY_KEY =
  '67m:save-repository' as const;

const isSaveRepository = (
  value: unknown,
): value is SaveRepository =>
  typeof value === 'object' &&
  value !== null &&
  'load' in value &&
  typeof value.load === 'function' &&
  'write' in value &&
  typeof value.write === 'function' &&
  'flush' in value &&
  typeof value.flush === 'function';

export const getSceneSaveRepository = (
  scene: Phaser.Scene,
): SaveRepository => {
  const value = scene.game.registry.get(
    GAME_SAVE_REPOSITORY_REGISTRY_KEY,
  ) as unknown;

  if (!isSaveRepository(value)) {
    throw new Error(
      'Game save repository is not registered',
    );
  }

  return value;
};
