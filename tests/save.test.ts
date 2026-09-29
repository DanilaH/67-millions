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
import {
  assertDropBoardCompatible,
  commitBareDrop,
} from '../src/core/plinko-rules/drop';

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
    save.game.jobLevels.dishes = 2;
    save.game.dumpsterSearchStreak = 3;
    save.game.statuses.SMELLY = true;
    save.game.pendingEventId = 'EVENT_03';
    save.game.eventsResolvedThisGameDay = 1;
    save.game.lastResolvedEventId = 'EVENT_02';
    await repo.write(save);
    await repo.flush();

    const restored = await repo.load();
    expect(restored.version).toBe(12);
    expect(restored.game.cash).toBe(777);
    expect(restored.game.jobLevels).toEqual({
      dishes: 2,
      trash: 1,
      courier: 1,
    });
    expect(restored.game.dumpsterSearchStreak).toBe(3);
    expect(restored.game.statuses.SMELLY).toBe(true);
    expect(restored.game.pendingEventId).toBe('EVENT_03');
    expect(restored.game.eventsResolvedThisGameDay).toBe(1);
    expect(restored.game.lastResolvedEventId).toBe('EVENT_02');
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

  it('migrates a valid v1 core save to v6', async () => {
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

    expect(migrated.version).toBe(12);
    expect(migrated.game.barryInterruptPending).toBe(false);
    expect(migrated.game.workPayoutMultiplier).toBe(1);
    expect(migrated.game.plinkoSelectedBetFraction).toBe(1);
    expect(migrated.game.plinkoMaxBetLevel).toBe(0);
    expect(migrated.game.plinkoCenterLevel).toBe(0);
    expect(migrated.game.plinkoMidLevel).toBe(0);
    expect(migrated.game.plinkoJackpotLevel).toBe(0);
    expect(migrated.game.plinkoAmplifierLevel).toBe(0);
    expect(migrated.game.plinkoReturnLevel).toBe(0);
    expect(migrated.game.plinkoSplitterLevel).toBe(0);
    expect(migrated.game.plinkoJackpotBiasLevel).toBe(0);
    expect(migrated.game.plinkoInsuranceLevel).toBe(0);
    expect(migrated.game.plinkoInsuranceLossStreak).toBe(0);
    expect(migrated.game.plinkoInsuranceArmed).toBeNull();
    expect(migrated.game.jobLevels).toEqual({
      dishes: 1,
      trash: 1,
      courier: 1,
    });
  });


  it('migrates a valid v2 save to v6 with Plinko defaults', async () => {
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

    expect(migrated.version).toBe(12);
    expect(migrated.game.plinkoSelectedBetFraction).toBe(1);
    expect(migrated.game.plinkoMaxBetLevel).toBe(0);
    expect(migrated.game.plinkoCenterLevel).toBe(0);
    expect(migrated.game.plinkoMidLevel).toBe(0);
    expect(migrated.game.plinkoJackpotLevel).toBe(0);
    expect(migrated.game.plinkoAmplifierLevel).toBe(0);
    expect(migrated.game.plinkoReturnLevel).toBe(0);
    expect(migrated.game.plinkoSplitterLevel).toBe(0);
    expect(migrated.game.plinkoJackpotBiasLevel).toBe(0);
    expect(migrated.game.plinkoInsuranceLevel).toBe(0);
    expect(migrated.game.plinkoInsuranceLossStreak).toBe(0);
    expect(migrated.game.plinkoInsuranceArmed).toBeNull();
    expect(migrated.game.jobLevels).toEqual({
      dishes: 1,
      trash: 1,
      courier: 1,
    });
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

    expect(migrated.version).toBe(12);
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

  it('round-trips exact active-Drop physics in v12', async () => {
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
      specialLevelsAtCommit: {
        amplifierLevel: 0,
        returnLevel: 0,
        splitterLevel: 0,
        jackpotBiasLevel: 0,
      },
      insuranceAtCommit: null,
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
            watchdogStationaryTicks: 19,
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
    expect(
      restored.pendingDrop?.physics?.balls[0]?.watchdogStationaryTicks,
    ).toBe(19);
    expect(restored.pendingDrop?.insuranceAtCommit).toBeNull();
  });

  it('round-trips an active insured Drop without re-arming or duplicate floor', async () => {
    const storage = new MemoryStorage();
    const createGame = () => createInitialGameState(balance, 812);
    const repo = createSaveRepository(storage, createGame);
    const save = await repo.load();

    const armedGame = {
      ...save.game,
      cash: 10_000,
      plinkoInsuranceLevel: 1,
      plinkoInsuranceLossStreak: 3,
      plinkoInsuranceArmed: {
        level: 1,
        floor: 0.75,
      },
    };
    const committed = commitBareDrop(
      armedGame,
      null,
      balance,
      'insured-reload',
      1,
    );

    await repo.write({
      ...save,
      game: committed.state,
      pendingDrop: committed.pendingDrop,
    });
    await repo.flush();

    const restored = await createSaveRepository(
      storage,
      createGame,
    ).load();

    expect(restored.game.plinkoInsuranceArmed).toBeNull();
    expect(restored.game.plinkoInsuranceLossStreak).toBe(3);
    expect(restored.pendingDrop?.insuranceAtCommit).toEqual({
      level: 1,
      floor: 0.75,
    });

    const { settleAggregateDrop } = await import(
      '../src/core/plinko-rules/drop'
    );
    const settled = settleAggregateDrop(
      restored.game,
      restored.pendingDrop!,
      100,
      balance,
    );

    expect(settled.naturalPayout).toBe(100);
    expect(settled.payout).toBe(375);
    expect(settled.insuranceTopUp).toBe(275);
    expect(settled.state.cash).toBe(9_875);
    expect(settled.state.plinkoInsuranceLossStreak).toBe(0);
    expect(settled.state.plinkoInsuranceArmed).toBeNull();

    await repo.write({
      ...restored,
      game: settled.state,
      pendingDrop: null,
    });
    await repo.flush();

    const resolved = await createSaveRepository(
      storage,
      createGame,
    ).load();

    expect(resolved.pendingDrop).toBeNull();
    expect(resolved.game.cash).toBe(9_875);
    expect(resolved.game.plinkoInsuranceLossStreak).toBe(0);
    expect(resolved.game.plinkoInsuranceArmed).toBeNull();
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

    expect(migrated.version).toBe(12);
    expect(migrated.game.plinkoCenterLevel).toBe(0);
    expect(migrated.game.plinkoMidLevel).toBe(0);
    expect(migrated.game.plinkoJackpotLevel).toBe(0);
    expect(migrated.pendingDrop?.pocketLevelsAtCommit).toEqual({
      centerLevel: 0,
      midLevel: 0,
      jackpotLevel: 0,
    });
    expect(migrated.pendingDrop?.specialLevelsAtCommit).toEqual({
      amplifierLevel: 0,
      returnLevel: 0,
      splitterLevel: 0,
      jackpotBiasLevel: 0,
    });
    expect(migrated.pendingDrop?.physics?.fixedTicksElapsed).toBe(77);
    expect(migrated.pendingDrop?.insuranceAtCommit).toBeNull();
  });

  it('migrates a v5 active Drop by preserving exact physics and assigning zero special levels', async () => {
    const storage = new MemoryStorage();
    const game = createInitialGameState(balance, 556);
    const {
      plinkoAmplifierLevel: _amp,
      plinkoReturnLevel: _return,
      plinkoSplitterLevel: _splitter,
      ...legacyGame
    } = game;

    const raw = {
      version: 5,
      game: legacyGame,
      activeAction: null,
      pendingDrop: {
        dropId: 'v5-active-drop',
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
        remainingActionMinutes: 5,
        rngStateAtCommit: 556,
        boardFingerprint: JSON.stringify({ version: 2, legacy: true }),
        physics: {
          fixedTicksElapsed: 88,
          alreadySettledPayout: 125,
          balls: [
            {
              ballId: 'v5-active-drop:root',
              x: 641,
              y: 260,
              velocityX: -0.25,
              velocityY: 2.1,
              angle: 0,
              angularVelocity: 0,
              currentValue: 1.25,
              lineageId: 'v5-active-drop:root',
              splitDepth: 0,
              amplifierProcIds: ['r6c3'],
              returnUsed: true,
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

    expect(migrated.version).toBe(12);
    expect(migrated.game.plinkoAmplifierLevel).toBe(0);
    expect(migrated.game.plinkoReturnLevel).toBe(0);
    expect(migrated.game.plinkoSplitterLevel).toBe(0);
    expect(migrated.game.plinkoJackpotBiasLevel).toBe(0);
    expect(migrated.game.plinkoInsuranceLevel).toBe(0);
    expect(migrated.game.plinkoInsuranceLossStreak).toBe(0);
    expect(migrated.game.plinkoInsuranceArmed).toBeNull();
    expect(migrated.game.jobLevels).toEqual({
      dishes: 1,
      trash: 1,
      courier: 1,
    });
    expect(migrated.pendingDrop?.specialLevelsAtCommit).toEqual({
      amplifierLevel: 0,
      returnLevel: 0,
      splitterLevel: 0,
      jackpotBiasLevel: 0,
    });
    expect(migrated.pendingDrop?.physics?.alreadySettledPayout).toBe(125);
    expect(migrated.pendingDrop?.insuranceAtCommit).toBeNull();
    expect(migrated.pendingDrop?.physics?.balls[0]?.currentValue).toBe(1.25);
    expect(migrated.pendingDrop?.physics?.balls[0]?.returnUsed).toBe(true);
  });

  it('migrates a v6 active Drop with exact physics and zero Jackpot Bias', async () => {
    const storage = new MemoryStorage();
    const game = {
      ...createInitialGameState(balance, 667),
      plinkoCenterLevel: 1,
      plinkoAmplifierLevel: 1,
    };
    const {
      plinkoJackpotBiasLevel: _bias,
      ...legacyGame
    } = game;

    const pocketLevelsAtCommit = {
      centerLevel: 1,
      midLevel: 0,
      jackpotLevel: 0,
    };
    const legacySpecialLevels = {
      amplifierLevel: 1,
      returnLevel: 0,
      splitterLevel: 0,
    };

    const { createSpecialBoardFingerprintV3 } = await import(
      '../src/core/plinko-rules/drop'
    );

    const raw = {
      version: 6,
      game: legacyGame,
      activeAction: null,
      pendingDrop: {
        dropId: 'v6-active-drop',
        originalStake: 500,
        selectedFraction: 1,
        maxBetLevel: 0,
        pocketLevelsAtCommit,
        specialLevelsAtCommit: legacySpecialLevels,
        committedGameDayIndex: 0,
        committedMinuteOfDay: 600,
        remainingActionMinutes: 4,
        rngStateAtCommit: 667,
        boardFingerprint: createSpecialBoardFingerprintV3(
          balance,
          pocketLevelsAtCommit,
          legacySpecialLevels,
        ),
        physics: {
          fixedTicksElapsed: 99,
          alreadySettledPayout: 0,
          balls: [
            {
              ballId: 'v6-active-drop:root',
              x: 610,
              y: 280,
              velocityX: 0.25,
              velocityY: 1.75,
              angle: 0,
              angularVelocity: 0,
              currentValue: 1.25,
              lineageId: 'v6-active-drop:root',
              splitDepth: 0,
              amplifierProcIds: ['r6c3'],
              returnUsed: false,
              blockedSplitterId: null,
              watchdogStationaryTicks: 11,
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

    expect(migrated.version).toBe(12);
    expect(migrated.game.plinkoJackpotBiasLevel).toBe(0);
    expect(migrated.game.plinkoInsuranceLevel).toBe(0);
    expect(migrated.game.plinkoInsuranceLossStreak).toBe(0);
    expect(migrated.game.plinkoInsuranceArmed).toBeNull();
    expect(migrated.game.jobLevels).toEqual({
      dishes: 1,
      trash: 1,
      courier: 1,
    });
    expect(migrated.pendingDrop?.specialLevelsAtCommit).toEqual({
      ...legacySpecialLevels,
      jackpotBiasLevel: 0,
    });
    expect(migrated.pendingDrop?.physics?.fixedTicksElapsed).toBe(99);
    expect(migrated.pendingDrop?.insuranceAtCommit).toBeNull();
    expect(migrated.pendingDrop?.physics?.balls[0]?.watchdogStationaryTicks).toBe(11);
    expect(() =>
      assertDropBoardCompatible(
        migrated.pendingDrop!,
        balance,
        migrated.game,
      ),
    ).not.toThrow();
  });

  it('migrates a v7 active Drop with exact physics and zero Insurance state', async () => {
    const storage = new MemoryStorage();
    const game = {
      ...createInitialGameState(balance, 778),
      cash: 5_000,
      plinkoJackpotBiasLevel: 2,
    };
    const committed = commitBareDrop(
      game,
      null,
      balance,
      'v7-active-drop',
      1,
    );

    const {
      plinkoInsuranceLevel: _insuranceLevel,
      plinkoInsuranceLossStreak: _insuranceStreak,
      plinkoInsuranceArmed: _insuranceArmed,
      ...legacyGame
    } = committed.state;
    const {
      insuranceAtCommit: _insuranceAtCommit,
      ...legacyPendingDrop
    } = committed.pendingDrop;

    await storage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify({
        version: 7,
        game: legacyGame,
        activeAction: null,
        pendingDrop: legacyPendingDrop,
      }),
    );

    const migrated = await createSaveRepository(
      storage,
      () => createInitialGameState(balance, 999),
    ).load();

    expect(migrated.version).toBe(12);
    expect(migrated.game.plinkoInsuranceLevel).toBe(0);
    expect(migrated.game.plinkoInsuranceLossStreak).toBe(0);
    expect(migrated.game.plinkoInsuranceArmed).toBeNull();
    expect(migrated.game.jobLevels).toEqual({
      dishes: 1,
      trash: 1,
      courier: 1,
    });
    expect(migrated.pendingDrop?.insuranceAtCommit).toBeNull();
    expect(migrated.pendingDrop?.boardFingerprint).toBe(
      committed.pendingDrop.boardFingerprint,
    );
    expect(() =>
      assertDropBoardCompatible(
        migrated.pendingDrop!,
        balance,
        migrated.game,
      ),
    ).not.toThrow();
  });

  it('migrates v8 saves by adding L1 job progression without changing existing economy state', async () => {
    const storage = new MemoryStorage();
    const currentGame = {
      ...createInitialGameState(balance, 889),
      cash: 12_345,
      plinkoInsuranceLevel: 2,
      plinkoInsuranceLossStreak: 1,
    };
    const {
      jobLevels: _jobLevels,
      ...legacyGame
    } = currentGame;

    await storage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify({
        version: 8,
        game: legacyGame,
        activeAction: null,
        pendingDrop: null,
      }),
    );

    const migrated = await createSaveRepository(
      storage,
      () => createInitialGameState(balance, 999),
    ).load();

    expect(migrated.version).toBe(12);
    expect(migrated.game.cash).toBe(12_345);
    expect(migrated.game.plinkoInsuranceLevel).toBe(2);
    expect(migrated.game.plinkoInsuranceLossStreak).toBe(1);
    expect(migrated.game.jobLevels).toEqual({
      dishes: 1,
      trash: 1,
      courier: 1,
    });
    expect(migrated.game.dumpsterSearchStreak).toBe(0);
  });

  it('migrates v9 saves by adding a zero dumpster search streak', async () => {
    const storage = new MemoryStorage();
    const currentGame = {
      ...createInitialGameState(balance, 890),
      cash: 54_321,
      jobLevels: {
        dishes: 2,
        trash: 1,
        courier: 3,
      },
    };
    const {
      dumpsterSearchStreak: _dumpsterSearchStreak,
      ...legacyGame
    } = currentGame;

    await storage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify({
        version: 9,
        game: legacyGame,
        activeAction: null,
        pendingDrop: null,
      }),
    );

    const migrated = await createSaveRepository(
      storage,
      () => createInitialGameState(balance, 999),
    ).load();

    expect(migrated.version).toBe(12);
    expect(migrated.game.cash).toBe(54_321);
    expect(migrated.game.jobLevels).toEqual({
      dishes: 2,
      trash: 1,
      courier: 3,
    });
    expect(migrated.game.dumpsterSearchStreak).toBe(0);
    expect(migrated.game.statuses.SMELLY).toBe(false);
  });

  it('migrates v10 saves by adding a clean SMELLY status', async () => {
    const storage = new MemoryStorage();
    const currentGame = {
      ...createInitialGameState(balance, 891),
      cash: 7_654,
      dumpsterSearchStreak: 2,
    };
    const {
      statuses: _statuses,
      ...legacyGame
    } = currentGame;

    await storage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify({
        version: 10,
        game: legacyGame,
        activeAction: null,
        pendingDrop: null,
      }),
    );

    const migrated = await createSaveRepository(
      storage,
      () => createInitialGameState(balance, 999),
    ).load();

    expect(migrated.version).toBe(12);
    expect(migrated.game.cash).toBe(7_654);
    expect(migrated.game.dumpsterSearchStreak).toBe(2);
    expect(migrated.game.statuses.SMELLY).toBe(false);
    expect(migrated.game.pendingEventId).toBeNull();
    expect(migrated.game.eventsResolvedThisGameDay).toBe(0);
    expect(migrated.game.lastResolvedEventId).toBeNull();
  });

  it('migrates v11 saves by adding empty event scheduler state', async () => {
    const storage = new MemoryStorage();
    const currentGame = {
      ...createInitialGameState(balance, 892),
      cash: 8_765,
      statuses: { SMELLY: true },
    };
    const {
      pendingEventId: _pendingEventId,
      eventsResolvedThisGameDay: _eventsResolvedThisGameDay,
      lastResolvedEventId: _lastResolvedEventId,
      ...legacyGame
    } = currentGame;

    await storage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify({
        version: 11,
        game: legacyGame,
        activeAction: null,
        pendingDrop: null,
      }),
    );

    const migrated = await createSaveRepository(
      storage,
      () => createInitialGameState(balance, 999),
    ).load();

    expect(migrated.version).toBe(12);
    expect(migrated.game.cash).toBe(8_765);
    expect(migrated.game.statuses.SMELLY).toBe(true);
    expect(migrated.game.pendingEventId).toBeNull();
    expect(migrated.game.eventsResolvedThisGameDay).toBe(0);
    expect(migrated.game.lastResolvedEventId).toBeNull();
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
    const raw = JSON.stringify({ version: 12, game: { cash: -999 } });
    await storage.setItem(SAVE_STORAGE_KEY, raw);

    const repo = createSaveRepository(storage, () => createInitialGameState(balance, 123));

    await expect(repo.load()).rejects.toThrow();
    expect(await storage.getItem(SAVE_STORAGE_KEY)).toBe(raw);
  });
});
