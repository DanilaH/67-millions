import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import { createInitialGameState } from '../src/core/state/GameState';
import {
  HIGH_VARIANCE_ARCHETYPES,
  createHighVariancePolicy,
  getHighVariancePolicyProfile,
} from '../simulation/full-game/highVariancePolicies';
import {
  runFullGame,
  type FullGameCounters,
  type PlinkoOutcomeModel,
} from '../simulation/full-game/runner';

const zeroCounters = (): FullGameCounters => ({
  decisions: 0,
  gameMinutesAdvanced: 0,
  workShifts: 0,
  plinkoDrops: 0,
  foodActions: 0,
  entertainmentActions: 0,
  dumpsterSearches: 0,
  showers: 0,
  sleeps: 0,
  eventsResolved: 0,
  purchases: 0,
});

const volatileTestPlinko: PlinkoOutcomeModel = {
  id: 'test-volatile',
  resolve: ({ state, pendingDrop, dropIndex }) => ({
    aggregatePayout:
      dropIndex % 5 === 0
        ? pendingDrop.originalStake * 3
        : Math.round(pendingDrop.originalStake * 0.4),
    nextRngState: (state.rngState + 0x85ebca6b) >>> 0,
  }),
};

describe('high-variance full-game policies', () => {
  it('defines DEGENERATE and RECKLESS_NEEDS with explicit skill assumptions', () => {
    expect(HIGH_VARIANCE_ARCHETYPES).toEqual([
      'DEGENERATE',
      'RECKLESS_NEEDS',
    ]);
    expect(
      getHighVariancePolicyProfile('DEGENERATE')
        .workFailureProbability,
    ).toBe(0.14);
    expect(
      getHighVariancePolicyProfile('RECKLESS_NEEDS')
        .workFailureProbability,
    ).toBe(0.16);
  });

  it('DEGENERATE prioritizes Jackpot Bias before other growth when affordable', () => {
    const state = {
      ...createInitialGameState(balance, 11),
      cash: 1_000_000,
    };
    const policy = createHighVariancePolicy(
      balance,
      'DEGENERATE',
      11,
    );

    const decision = policy.decide({
      state,
      activeAction: null,
      counters: zeroCounters(),
      decisionIndex: 0,
    });

    expect(decision).toEqual({
      type: 'BUY_PLINKO_SPECIAL',
      track: 'jackpotBias',
    });
  });

  it('RECKLESS_NEEDS prioritizes max-bet growth when affordable', () => {
    const state = {
      ...createInitialGameState(balance, 12),
      cash: 100_000,
    };
    const policy = createHighVariancePolicy(
      balance,
      'RECKLESS_NEEDS',
      12,
    );

    const decision = policy.decide({
      state,
      activeAction: null,
      counters: zeroCounters(),
      decisionIndex: 0,
    });

    expect(decision.type).toBe('BUY_PLINKO_MAX_BET');
  });

  it('high-variance policies choose the largest quick bet that still preserves their smaller reserve', () => {
    const state = {
      ...createInitialGameState(balance, 13),
      cash: 9_000,
      plinkoMaxBetLevel: 2,
      plinkoJackpotBiasLevel:
        balance.plinko.jackpotBias[
          balance.plinko.jackpotBias.length - 1
        ]!.level,
      plinkoSplitterLevel:
        balance.plinko.splitter[
          balance.plinko.splitter.length - 1
        ]!.level,
      plinkoJackpotLevel:
        balance.plinko.jackpotUpgrades[
          balance.plinko.jackpotUpgrades.length - 1
        ]!.level,
      plinkoAmplifierLevel:
        balance.plinko.amplifier[
          balance.plinko.amplifier.length - 1
        ]!.level,
    };

    expect(
      createHighVariancePolicy(
        balance,
        'DEGENERATE',
        13,
      ).decide({
        state,
        activeAction: null,
        counters: zeroCounters(),
        decisionIndex: 0,
      }),
    ).toEqual({ type: 'PLINKO', fraction: 0.25 });

    expect(
      createHighVariancePolicy(
        balance,
        'RECKLESS_NEEDS',
        13,
      ).decide({
        state,
        activeAction: null,
        counters: zeroCounters(),
        decisionIndex: 0,
      }),
    ).toEqual({ type: 'PLINKO', fraction: 0.5 });
  });

  it('RECKLESS_NEEDS delays satiety recovery until critical and then uses dumpster', () => {
    const policy = createHighVariancePolicy(
      balance,
      'RECKLESS_NEEDS',
      14,
    );

    const aboveCritical = policy.decide({
      state: {
        ...createInitialGameState(balance, 14),
        needs: {
          health: 100,
          satiety: 9,
          energy: 100,
          happiness: 100,
        },
      },
      activeAction: null,
      counters: zeroCounters(),
      decisionIndex: 0,
    });

    expect(aboveCritical.type).toBe('WORK');

    const critical = policy.decide({
      state: {
        ...createInitialGameState(balance, 14),
        needs: {
          health: 100,
          satiety: 8,
          energy: 100,
          happiness: 100,
        },
      },
      activeAction: null,
      counters: zeroCounters(),
      decisionIndex: 1,
    });

    expect(critical.type).toBe('DUMPSTER');
  });

  it.each(HIGH_VARIANCE_ARCHETYPES)(
    '%s exposes deterministic 0%/100% work-failure overrides',
    (archetype) => {
      const state = createInitialGameState(balance, 15);

      const success = createHighVariancePolicy(
        balance,
        archetype,
        15,
        { workFailureProbability: 0 },
      ).decide({
        state,
        activeAction: null,
        counters: zeroCounters(),
        decisionIndex: 0,
      });
      const failure = createHighVariancePolicy(
        balance,
        archetype,
        15,
        { workFailureProbability: 1 },
      ).decide({
        state,
        activeAction: null,
        counters: zeroCounters(),
        decisionIndex: 0,
      });

      expect(success.type).toBe('WORK');
      expect(failure.type).toBe('WORK');
      if (success.type === 'WORK' && failure.type === 'WORK') {
        expect(success.result).toBe('SUCCESS');
        expect(failure.result).toBe('FAILURE');
      }
    },
  );

  it.each(HIGH_VARIANCE_ARCHETYPES)(
    '%s can execute a bounded canonical run without invalid decisions',
    (archetype) => {
      const seed =
        20_000 + HIGH_VARIANCE_ARCHETYPES.indexOf(archetype);
      const policy = createHighVariancePolicy(
        balance,
        archetype,
        seed,
      );

      const result = runFullGame(
        balance,
        policy,
        volatileTestPlinko,
        {
          seed,
          configHash: 'test-config-hash',
          maxDecisions: 2_000,
          maxGameMinutes: 2 * 24 * 60,
        },
      );

      expect(result.policyId).toBe(policy.id);
      expect([
        'VICTORY',
        'BARRY_LOSS',
        'HP_DEATH',
        'STEP_LIMIT',
      ]).toContain(result.outcome);
      expect(result.counters.decisions).toBeGreaterThan(0);
    },
  );
});
