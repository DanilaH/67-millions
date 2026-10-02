import { describe, expect, it, vi } from 'vitest';
import type { StorageAdapter } from '@danilah/mini-games-kit/platform';
import { withSaveRetry } from '../src/core/save/retryStorage';
import { createSaveRepository } from '../src/core/save/repository';
import { createInitialGameState } from '../src/core/state/GameState';
import { createSaveState } from '../src/core/save/SaveState';
import { balance } from '../src/config/balance';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};

describe('save write recovery', () => {
  for (const ambiguous of [false, true]) {
    it(`preserves ordered immutable snapshots after ${ambiguous ? 'write-then-error' : 'rejected write'}`, async () => {
      let raw: string | null = null;
      const attempts: string[] = [];
      const retry = deferred();
      const failed = deferred();
      const storage: StorageAdapter = {
        getItem: async () => raw,
        removeItem: async () => { raw = null; },
        setItem: async (_key, value) => {
          attempts.push(value);
          if (attempts.length === 1) {
            if (ambiguous) raw = value;
            throw new Error('quota');
          }
          raw = value;
        },
      };
      const committed = vi.fn();
      const recovered = vi.fn();
      const repo = createSaveRepository(withSaveRetry(storage, {
        waitForRetry: () => { failed.resolve(); return retry.promise; }, recovered,
      }), () => createInitialGameState(balance, 123), { loaded: () => {}, committed });
      const first = createSaveState(createInitialGameState(balance, 123));
      first.game.cash = 100;
      const firstWrite = repo.write(first);
      await failed.promise;
      first.game.cash = 999; // caller changes must not alter a pending retry
      const second = structuredClone(first); second.game.cash = 200;
      const secondWrite = repo.write(second);
      expect(attempts).toHaveLength(1);
      expect(committed).not.toHaveBeenCalled();
      retry.resolve();
      await Promise.all([firstWrite, secondWrite, repo.flush()]);
      expect(attempts).toHaveLength(3);
      expect(attempts[1]).toBe(attempts[0]);
      expect((await repo.load()).game.cash).toBe(200);
      expect(committed.mock.calls.map(([save]) => save.game.cash)).toEqual([100, 200]);
      expect(recovered).toHaveBeenCalledTimes(1);
    });
  }

  it('keeps awaiting user retries through repeated failures', async () => {
    const setItem = vi.fn().mockRejectedValueOnce(new Error('quota')).mockRejectedValueOnce(new Error('quota')).mockResolvedValue(undefined);
    const waitForRetry = vi.fn().mockResolvedValue(undefined);
    const recovered = vi.fn();
    await withSaveRetry({ getItem: async () => null, removeItem: async () => {}, setItem }, { waitForRetry, recovered }).setItem('save', 'same bytes');
    expect(setItem.mock.calls).toEqual(Array(3).fill(['save', 'same bytes']));
    expect(waitForRetry).toHaveBeenCalledTimes(2);
    expect(recovered).toHaveBeenCalledTimes(1);
  });
});
