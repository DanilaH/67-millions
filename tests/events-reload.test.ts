import { describe, expect, it } from 'vitest';

import type { StorageAdapter } from '@danilah/mini-games-kit/platform';

import type { BalanceConfig } from '../src/config/balance.schema';
import { balance } from '../src/config/balance';
import {
  resolveEventChoice,
} from '../src/core/events/eventEffects';
import {
  advanceEventCheckpoints,
  getPresentablePendingEventId,
} from '../src/core/events/eventScheduler';
import {
  createSaveRepository,
} from '../src/core/save/repository';
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

const alwaysRollConfig = (): BalanceConfig => ({
  ...balance,
  events: {
    ...balance.events,
    chancePerCheckpoint: 1,
  },
});

describe('event save/reload determinism', () => {
  it('restores the exact pending event and RNG state instead of rerolling it', async () => {
    const config = alwaysRollConfig();
    const storage = new MemoryStorage();
    const createGame = () => createInitialGameState(config, 123456);
    const repo = createSaveRepository(storage, createGame);
    const save = await repo.load();

    const rolled = advanceEventCheckpoints(
      save.game,
      ['13:00'],
      config,
      { isSleeping: false },
    );

    expect(rolled.state.pendingEventId).not.toBeNull();

    save.game = rolled.state;
    await repo.write(save);
    await repo.flush();

    const restored = await createSaveRepository(
      storage,
      createGame,
    ).load();

    expect(restored.game.pendingEventId).toBe(
      rolled.state.pendingEventId,
    );
    expect(restored.game.rngState).toBe(rolled.state.rngState);

    const suppressed = advanceEventCheckpoints(
      restored.game,
      ['17:00'],
      config,
      { isSleeping: false },
    );

    expect(suppressed.attemptedCheckpoints).toBe(0);
    expect(suppressed.state.pendingEventId).toBe(
      restored.game.pendingEventId,
    );
    expect(suppressed.state.rngState).toBe(
      restored.game.rngState,
    );
  });

  it('keeps a shown pending event shown after reload until the player chooses', async () => {
    const config = alwaysRollConfig();
    const storage = new MemoryStorage();
    const createGame = () => createInitialGameState(config, 654321);
    const repo = createSaveRepository(storage, createGame);
    const save = await repo.load();

    const rolled = advanceEventCheckpoints(
      save.game,
      ['13:00'],
      config,
      { isSleeping: false },
    );

    const shownBefore = getPresentablePendingEventId(
      rolled.state,
      {
        skillInputActive: false,
        pendingDropActive: false,
      },
    );
    expect(shownBefore).not.toBeNull();

    save.game = rolled.state;
    await repo.write(save);
    await repo.flush();

    const restored = await createSaveRepository(
      storage,
      createGame,
    ).load();

    const shownAfter = getPresentablePendingEventId(
      restored.game,
      {
        skillInputActive: false,
        pendingDropActive: false,
      },
    );

    expect(shownAfter).toBe(shownBefore);
  });

  it('EVENT_09 chooses the same random unlocked job after reload', async () => {
    const storage = new MemoryStorage();
    const createGame = () => createInitialGameState(balance, 777777);
    const repo = createSaveRepository(storage, createGame);
    const save = await repo.load();

    save.game = {
      ...save.game,
      pendingEventId: 'EVENT_09',
      rngState: 0x12345678,
      eventModifiers: {
        ...save.game.eventModifiers,
        jobLockRemainingMinutes: {
          dishes: 0,
          trash: 120,
          courier: 0,
        },
      },
    };

    await repo.write(save);
    await repo.flush();

    const restored = await createSaveRepository(
      storage,
      createGame,
    ).load();

    const originalResolution = resolveEventChoice(
      save.game,
      balance,
      'EVENT_09',
      'b',
    );
    const restoredResolution = resolveEventChoice(
      restored.game,
      balance,
      'EVENT_09',
      'b',
    );

    expect(restoredResolution.lockedJobId).toBe(
      originalResolution.lockedJobId,
    );
    expect(restoredResolution.state.rngState).toBe(
      originalResolution.state.rngState,
    );
    expect(
      restoredResolution.state.eventModifiers.jobLockRemainingMinutes,
    ).toEqual(
      originalResolution.state.eventModifiers.jobLockRemainingMinutes,
    );
  });

  it('persists resolved-event identity so reload cannot immediately repeat it', async () => {
    const config = alwaysRollConfig();
    const storage = new MemoryStorage();
    const createGame = () => createInitialGameState(config, 888888);
    const repo = createSaveRepository(storage, createGame);
    const save = await repo.load();

    save.game = {
      ...save.game,
      lastResolvedEventId: 'EVENT_03',
    };

    await repo.write(save);
    await repo.flush();

    const restored = await createSaveRepository(
      storage,
      createGame,
    ).load();

    const rolled = advanceEventCheckpoints(
      restored.game,
      ['13:00'],
      config,
      {
        isSleeping: false,
        eligibleEventIds: ['EVENT_03', 'EVENT_04'],
      },
    );

    expect(rolled.state.pendingEventId).toBe('EVENT_04');
  });
});
