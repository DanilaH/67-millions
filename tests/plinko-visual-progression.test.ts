import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import {
  commitBareDrop,
} from '../src/core/plinko-rules/drop';
import type {
  ActiveSpecialPins,
} from '../src/core/plinko-rules/cascade';
import { createInitialGameState } from '../src/core/state/GameState';
import {
  derivePegVisualRoles,
  derivePlinkoVisualSnapshot,
  getPegVisualRole,
  getPocketVisualRole,
} from '../src/game/casino/plinkoVisualModel';

describe('T063 Plinko visual progression model', () => {
  it('starts with the bare board and canonical pocket families', () => {
    const state = createInitialGameState(
      balance,
      6_301,
    );
    const snapshot = derivePlinkoVisualSnapshot(
      state,
      null,
      balance,
    );

    expect(snapshot.progressionUnits).toBe(0);
    expect(snapshot.pocketMultipliers).toEqual(
      balance.plinko.basePockets,
    );
    expect(Object.keys(snapshot.pegRoles)).toHaveLength(0);

    expect(
      Array.from({ length: 10 }, (_, index) =>
        getPocketVisualRole(index, balance),
      ),
    ).toEqual([
      'jackpot',
      'outer',
      'mid',
      'inner',
      'center',
      'center',
      'inner',
      'mid',
      'outer',
      'jackpot',
    ]);
  });

  it('derives distinct visible roles for all active special systems', () => {
    const state = {
      ...createInitialGameState(balance, 6_302),
      plinkoAmplifierLevel: 5,
      plinkoReturnLevel: 4,
      plinkoSplitterLevel: 5,
      plinkoJackpotBiasLevel: 4,
    };

    const snapshot = derivePlinkoVisualSnapshot(
      state,
      null,
      balance,
    );

    expect(
      Object.values(snapshot.pegRoles).filter(
        (role) => role === 'amplifier',
      ),
    ).toHaveLength(3);
    expect(
      Object.values(snapshot.pegRoles).filter(
        (role) => role === 'return',
      ),
    ).toHaveLength(2);
    expect(
      Object.values(snapshot.pegRoles).filter(
        (role) => role === 'splitter',
      ),
    ).toHaveLength(1);

    for (const pegId of snapshot.activePins.amplifier?.pegIds ?? []) {
      expect(
        getPegVisualRole(pegId, snapshot.pegRoles),
      ).toBe('amplifier');
    }
    for (const pegId of snapshot.activePins.return?.pegIds ?? []) {
      expect(
        getPegVisualRole(pegId, snapshot.pegRoles),
      ).toBe('return');
    }
    for (const pegId of snapshot.activePins.splitter?.pegIds ?? []) {
      expect(
        getPegVisualRole(pegId, snapshot.pegRoles),
      ).toBe('splitter');
    }
  });

  it('keeps an active Drop visually pinned to its committed board snapshot', () => {
    const committedState = {
      ...createInitialGameState(balance, 6_303),
      cash: 10_000_000,
      plinkoMaxBetLevel: 3,
      plinkoCenterLevel: 1,
      plinkoMidLevel: 2,
      plinkoJackpotLevel: 2,
      plinkoAmplifierLevel: 2,
      plinkoReturnLevel: 2,
      plinkoSplitterLevel: 2,
      plinkoJackpotBiasLevel: 2,
      plinkoInsuranceLevel: 2,
      plinkoInsuranceArmed: {
        level: 2,
        floor: 0.9,
      },
    };

    const committed = commitBareDrop(
      committedState,
      null,
      balance,
      'visual-commit',
      0.25,
    );

    const impossibleLaterMutation = {
      ...committed.state,
      plinkoMaxBetLevel: 6,
      plinkoCenterLevel: 2,
      plinkoMidLevel: 3,
      plinkoJackpotLevel: 3,
      plinkoAmplifierLevel: 5,
      plinkoReturnLevel: 4,
      plinkoSplitterLevel: 5,
      plinkoJackpotBiasLevel: 4,
      plinkoInsuranceLevel: 3,
    };

    const snapshot = derivePlinkoVisualSnapshot(
      impossibleLaterMutation,
      committed.pendingDrop,
      balance,
    );

    expect(snapshot.maxBetLevel).toBe(3);
    expect(snapshot.pocketLevels).toEqual({
      centerLevel: 1,
      midLevel: 2,
      jackpotLevel: 2,
    });
    expect(snapshot.specialLevels).toEqual({
      amplifierLevel: 2,
      returnLevel: 2,
      splitterLevel: 2,
      jackpotBiasLevel: 2,
    });
    expect(snapshot.insuranceArmed).toBe(true);
    expect(
      snapshot.pocketMultipliers,
    ).toEqual(
      derivePlinkoVisualSnapshot(
        committedState,
        null,
        balance,
      ).pocketMultipliers,
    );
  });

  it('rejects overlapping special-pin visual identities', () => {
    const overlapping: ActiveSpecialPins = {
      amplifier: {
        pegIds: ['r3c1'],
        multiplier: 1.25,
      },
      return: {
        pegIds: ['r3c1'],
      },
      splitter: null,
    };

    expect(() =>
      derivePegVisualRoles(overlapping),
    ).toThrow(
      'Special pin r3c1 has overlapping visual roles',
    );
  });

  it('counts machine progression from visible upgrade systems', () => {
    const state = {
      ...createInitialGameState(balance, 6_304),
      plinkoMaxBetLevel: 4,
      plinkoCenterLevel: 2,
      plinkoMidLevel: 3,
      plinkoJackpotLevel: 3,
      plinkoAmplifierLevel: 5,
      plinkoReturnLevel: 4,
      plinkoSplitterLevel: 5,
      plinkoJackpotBiasLevel: 4,
      plinkoInsuranceLevel: 3,
    };

    const snapshot = derivePlinkoVisualSnapshot(
      state,
      null,
      balance,
    );

    expect(snapshot.progressionUnits).toBe(
      4 + 2 + 3 + 3 + 5 + 4 + 5 + 4 + 3,
    );
  });
});
