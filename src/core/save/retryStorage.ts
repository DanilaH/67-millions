import type { StorageAdapter } from '@danilah/mini-games-kit/platform';

export interface SaveRecovery {
  waitForRetry(error: unknown): Promise<void>;
  recovered(): void;
}

// JsonStorageRepository owns serialization. Keep its current write pending until
// the exact same immutable bytes have been accepted; never replay game commands.
export const withSaveRetry = (storage: StorageAdapter, recovery: SaveRecovery): StorageAdapter => ({
  getItem: (key) => storage.getItem(key),
  removeItem: (key) => storage.removeItem(key),
  setItem: async (key, value) => {
    let interrupted = false;
    for (;;) {
      try {
        await storage.setItem(key, value);
        break;
      } catch (error: unknown) {
        interrupted = true;
        await recovery.waitForRetry(error);
      }
    }
    if (interrupted) recovery.recovered();
  },
});
