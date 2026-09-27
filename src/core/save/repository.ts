import {
  JsonStorageRepository,
  WebStorageAdapter,
  type StorageAdapter,
} from '@danilah/mini-games-kit/platform';

import {
  createSaveState,
  type SaveState,
} from './SaveState';
import { migrateSaveState } from './migrations';
import type { GameState } from '../state/GameState';

export const SAVE_STORAGE_KEY = '67m.save';

export const createSaveRepository = (
  storage: StorageAdapter,
  createInitialGame: () => GameState,
): JsonStorageRepository<SaveState> =>
  new JsonStorageRepository<SaveState>({
    storage,
    key: SAVE_STORAGE_KEY,
    createDefault: () => createSaveState(createInitialGame()),
    codec: {
      decode: migrateSaveState,
      encode: (state) => state,
    },
  });

export const createLocalSaveRepository = (
  createInitialGame: () => GameState,
  storage: Storage = window.localStorage,
): JsonStorageRepository<SaveState> =>
  createSaveRepository(new WebStorageAdapter(storage), createInitialGame);
