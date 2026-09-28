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
    expect(restored.version).toBe(5);
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

  it('migrates a valid v1 core save to v5', async () => {
    const storage = new MemoryStorage();
    const legacyGame = createInitialGameState(balance, 123);
    const raw = JSON.stringify({
      version: 1,
      game: {
        cash: legacyGame.cash,
        mainDebt: legacyGame.mainDebt,
        clock: legacyGame.clock,
        needs: legacyGame.needs,
        barryPaymentIndex: legacyGame.barryPaymentIndex,
        rngState: legacyGame.rngState,
        terminalReason: legacyGame.terminalReason,
      },
      activeAction: null,
      pendingDrop: null,
    });
    await storage.setItem(SAVE_STORAGE_KEY, raw);

    const repo = createSaveRepository(storage, () => createInitialGameState(balance, 999));
    const migrated = await repo.load();

    expect(migrated.version).toBe(5);
    expect(migrated.game.barryInterruptPending).toBe(false);
    expect(migrated.game.workPayoutMultiplier).toBe(1);
    expect(migrated.game.plinkoSelectedBetFraction).toBe(1);
    expect(migrated.game.plinkoMaxBetLevel).toBe(0);
    expect(migrated.game.plinkoCenterLevel).toBe(0);
    expect(migrated.game.plinkoMidLevel).toBe(0);
    expect(migrated.game.plinkoJackpotLevel).toBe(0);
  });


  it('migrates a valid v2 save to v5 with Plinko defaults', async () => {
    const storage = new MemoryStorage();
    const game = createInitialGameState(balance, 321);
    const raw = JSON.stringify({
      version: 2,
      game: {
        cash: game.cash,
        mainDebt: game.mainDebt,
        clock: game.clock,
        needs: game.needs,
        barryPaymentIndex: game.barryPaymentIndex,
        barryInterruptPending: game.barryInterruptPending,
        totalBarryPaid: game.totalBarryPaid,
        sleepMinutesCurrentGameDay: game.sleepMinutesCurrentGameDay,
        workPayoutMultiplier: game.workPayoutMultiplier,
        rngState: game.rngState,
        terminalReason: game.terminalReason,
        victory: game.victory,
      },
      activeAction: null,
      pendingDrop: null,
    });
    await storage.setItem(SAVE_STORAGE_KEY, raw);

    const repo = createSaveRepository(storage, () => createInitialGameState(balance, 999));
    const migrated = await repo.load();

    expect(migrated.version).toBe(5);
    expect(migrated.game.plinkoSelectedBetFraction).toBe(1);
    expect(migrated.game.plinkoMaxBetLevel).toBe(0);
    expect(migrated.game.plinkoCenterLevel).toBe(0);
    expect(migrated.game.plinkoMidLevel).toBe(0);
    expect(migrated.game.plinkoJackpotLevel).toBe(0);
    expect(migrated.pendingDrop).toBeNull();
  });

  it('migrates a v3 save only when no active Drop needs invented physics', async () => {
    const storage = new MemoryStorage();
    const game = createInitialGameState(balance, 321);
    const baseV3 = {
      version: 3,
      game,
      activeAction: null,
      pendingDrop: null,
    };

    await storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(baseV3));
    const repo = createSaveRepository(storage, () => createInitialGameState(balance, 999));
    const migrated = await repo.load();

    expect(migrated.version).toBe(5);
    expect(migrated.pendingDrop).toBeNull();

    await storage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify({
        ...baseV3,
        pendingDrop: {
          dropId: 'legacy-active-drop',
          originalStake: 500,
        },
      }),
    );

    const unsafeRepo = createSaveRepository(
      storage,
      () => createInitialGameState(balance, 999),
    );
    await expect(unsafeRepo.load()).rejects.toThrow(
      'without exact physics state',
    );
  });

  it('round-trips exact active-Drop physics in v5', async () => {
    const storage = new MemoryStorage();
    const repo = createSaveRepository(
      storage,
      () => createInitialGameState(balance, 555),
    );
    const save = await repo.load();

    save.pendingDrop = {
      dropId: 'drop-restore',
      originalStake: 500,
      selectedFraction: 1,
      maxBetLevel: 0,
      pocketLevelsAtCommit: {
        centerLevel: 0,
        midLevel: 0,
        jackpotLevel: 0,
      },
      committedGameDayIndex: 0,
      committedMinuteOfDay: 600,
      remainingActionMinutes: 15,
      rngStateAtCommit: 555,
      boardFingerprint: 'board-v1',
      physics: {
        fixedTicksElapsed: 321,
        alreadySettledPayout: 0,
        balls: [
          {
            ballId: 'drop-restore:root',
            x: 620.5,
            y: 281.25,
            velocityX: -0.7,
            velocityY: 2.4,
            angle: 0.1,
            angularVelocity: -0.02,
            currentValue: 1,
            lineageId: 'drop-restore:root',
            splitDepth: 0,
            amplifierProcIds: [],
            returnUsed: false,
            blockedSplitterId: null,
          },
        ],
      },
    };

    await repo.write(save);
    await repo.flush();

    const restored = await createSaveRepository(
      storage,
      () => createInitialGameState(balance, 999),
    ).load();

    expect(restored.pendingDrop).toEqual(save.pendingDrop);
  });

  it('migrates a v4 active Drop by preserving physics and assigning zero pocket levels', async () => {
    const storage = new MemoryStorage();
    const game = createInitialGameState(balance, 444);
    const {
      plinkoCenterLevel: _center,
      plinkoMidLevel: _mid,
      plinkoJackpotLevel: _jackpot,
      ...legacyGame
    } = game;

    const raw = {
      version: 4,
      game: legacyGame,
      activeAction: null,
      pendingDrop: {
        dropId: 'v4-active-drop',
        originalStake: 500,
        selectedFraction: 1,
        maxBetLevel: 0,
        committedGameDayIndex: 0,
        committedMinuteOfDay: 600,
        remainingActionMinutes: 5,
        rngStateAtCommit: 444,
        boardFingerprint: 'legacy-v4-fingerprint',
        physics: {
          fixedTicksElapsed: 77,
          alreadySettledPayout: 0,
          balls: [
            {
              ballId: 'v4-active-drop:root',
              x: 640,
              y: 250,
              velocityX: 0.5,
              velocityY: 2,
              angle: 0,
              angularVelocity: 0,
              currentValue: 1,
              lineageId: 'v4-active-drop:root',
              splitDepth: 0,
              amplifierProcIds: [],
              returnUsed: false,
              blockedSplitterId: null,
            },
          ],
        },
      },
    };

    await storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(raw));
    const migrated = await createSaveRepository(
      storage,
      () => createInitialGameState(balance, 999),
    ).load();

    expect(migrated.version).toBe(5);
    expect(migrated.game.plinkoCenterLevel).toBe(0);
    expect(migrated.game.plinkoMidLevel).toBe(0);
    expect(migrated.game.plinkoJackpotLevel).toBe(0);
    expect(migrated.pendingDrop?.pocketLevelsAtCommit).toEqual({
      centerLevel: 0,
      midLevel: 0,
      jackpotLevel: 0,
    });
    expect(migrated.pendingDrop?.physics?.fixedTicksElapsed).toBe(77);
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
    const raw = JSON.stringify({ version: 5, game: { cash: -999 } });
    await storage.setItem(SAVE_STORAGE_KEY, raw);

    const repo = createSaveRepository(storage, () => createInitialGameState(balance, 123));

    await expect(repo.load()).rejects.toThrow();
    expect(await storage.getItem(SAVE_STORAGE_KEY)).toBe(raw);
  });
});
