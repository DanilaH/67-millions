import {
  JsonStorageRepository,
  type StorageAdapter,
} from '@danilah/mini-games-kit/platform';

import {
  createSaveState,
  decodeSaveState,
  type SaveState,
} from './SaveState';
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
      decode: decodeSaveState,
      encode: (state) => state,
    },
  });
