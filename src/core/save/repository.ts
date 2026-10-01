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

export type SaveRepository =
  Pick<JsonStorageRepository<SaveState>, 'load' | 'write' | 'flush'>;

export const createSaveRepository = (
  storage: StorageAdapter,
  createInitialGame: () => GameState,
  observer?: { loaded(save: SaveState): void; committed(save: SaveState): void },
): SaveRepository => {
  const repository = new JsonStorageRepository<SaveState>({
    storage,
    key: SAVE_STORAGE_KEY,
    createDefault: () => createSaveState(createInitialGame()),
    codec: {
      decode: migrateSaveState,
      encode: (state) => state,
    },
  });
  return {
    load: async () => {
      const save = await repository.load();
      observer?.loaded(save);
      return save;
    },
    write: (save) => {
      const snapshot = structuredClone(save);
      return repository.write(snapshot).then(() => { observer?.committed(snapshot); });
    },
    flush: () => repository.flush(),
  };
};

export const createLocalSaveRepository = (
  createInitialGame: () => GameState,
  storage: Storage = window.localStorage,
): SaveRepository =>
  createSaveRepository(
    new WebStorageAdapter(storage),
    createInitialGame,
  );
