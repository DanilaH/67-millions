import { describe, expect, it } from 'vitest';

import type { StorageAdapter } from '@danilah/mini-games-kit/platform';

import { balance } from '../src/config/balance';
import { createSaveRepository } from '../src/core/save/repository';
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
});
