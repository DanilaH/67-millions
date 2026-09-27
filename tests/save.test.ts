import { describe, expect, it } from 'vitest';

import type { StorageAdapter } from '@danilah/mini-games-kit/platform';

import { balance } from '../src/config/balance';
import { createActiveAction } from '../src/core/actions/ActiveAction';
import {
  createLocalSaveRepository,
  createSaveRepository,
  SAVE_STORAGE_KEY,
} from '../src/core/save/repository';
import { UnsupportedSaveVersionError } from '../src/core/save/migrations';
import { createInitialGameState } from '../src/core/state/GameState';

class MemoryStorage implements StorageAdapter {
  private readonly values = new Map<string, string>();

  public async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  public async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  public async removeItem(key: string): Promise<void> {
    this.values.delete(key);
  }
}

class MemoryWebStorage implements Storage {
  private readonly values = new Map<string, string>();

  public get length(): number {
    return this.values.size;
  }

  public clear(): void {
    this.values.clear();
  }

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('save repository', () => {
  it('writes and restores a validated versioned core save', async () => {
    const storage = new MemoryStorage();
    const createGame = () => createInitialGameState(balance, 123);
    const repo = createSaveRepository(storage, createGame);

    const save = await repo.load();
    save.game.cash = 777;
    await repo.write(save);
    await repo.flush();

    const restored = await repo.load();
    expect(restored.version).toBe(1);
    expect(restored.game.cash).toBe(777);
  });

  it('uses the browser-local adapter without changing save semantics', async () => {
    const storage = new MemoryWebStorage();
    const createGame = () => createInitialGameState(balance, 777);
    const repo = createLocalSaveRepository(createGame, storage);

    const save = await repo.load();
    save.game.cash = 1234;
    await repo.write(save);

    const restored = await createLocalSaveRepository(createGame, storage).load();
    expect(restored.game.cash).toBe(1234);
  });

  it('restores remaining timed action without losing the upfront-payment marker', async () => {
    const storage = new MemoryStorage();
    const createGame = () => createInitialGameState(balance, 123);
    const repo = createSaveRepository(storage, createGame);
    const save = await repo.load();

    save.game.cash = 350;
    save.activeAction = createActiveAction({
      kind: 'TIMED_PAID',
      actionId: 'FOOD_01',
      remainingMinutes: 25,
      upfrontApplied: true,
      startedAtGameDayIndex: save.game.clock.gameDayIndex,
      startedAtMinuteOfDay: save.game.clock.minuteOfDay,
    });

    await repo.write(save);
    const restored = await repo.load();

    expect(restored.game.cash).toBe(350);
    expect(restored.activeAction).toEqual(save.activeAction);
    expect(restored.activeAction?.upfrontApplied).toBe(true);
  });

  it('rejects incompatible save versions without mutating stored data', async () => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify({ version: 999, untouched: true });
    await storage.setItem(SAVE_STORAGE_KEY, raw);

    const repo = createSaveRepository(storage, () => createInitialGameState(balance, 123));

    await expect(repo.load()).rejects.toBeInstanceOf(UnsupportedSaveVersionError);
    expect(await storage.getItem(SAVE_STORAGE_KEY)).toBe(raw);
  });

  it('rejects corrupt current-version data instead of silently resetting it', async () => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify({ version: 1, game: { cash: -999 } });
    await storage.setItem(SAVE_STORAGE_KEY, raw);

    const repo = createSaveRepository(storage, () => createInitialGameState(balance, 123));

    await expect(repo.load()).rejects.toThrow();
    expect(await storage.getItem(SAVE_STORAGE_KEY)).toBe(raw);
  });
});
