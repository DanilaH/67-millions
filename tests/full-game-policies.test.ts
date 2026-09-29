import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import { createInitialGameState } from '../src/core/state/GameState';
import {
  BASELINE_ARCHETYPES,
  createBaselinePolicy,
  deterministicPolicyRoll,
  getBaselinePolicyProfile,
} from '../simulation/full-game/policies';
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

const fairishPlinko: PlinkoOutcomeModel = {
  id: 'test-0.87x',
  resolve: ({ state, pendingDrop }) => ({
    aggregatePayout: Math.round(pendingDrop.originalStake * 0.87),
    nextRngState: (state.rngState + 0x9e3779b9) >>> 0,
  }),
};

describe('baseline full-game policies', () => {
  it('defines the four required archetypes with explicit work-failure probabilities', () => {
    expect(BASELINE_ARCHETYPES).toEqual([
      'CAUTIOUS',
      'BASELINE_GROWTH',
      'AGGRESSIVE',
      'WORKER',
    ]);

    expect(getBaselinePolicyProfile('CAUTIOUS').workFailureProbability).toBe(0.05);
    expect(getBaselinePolicyProfile('BASELINE_GROWTH').workFailureProbability).toBe(0.08);
    expect(getBaselinePolicyProfile('AGGRESSIVE').workFailureProbability).toBe(0.12);
    expect(getBaselinePolicyProfile('WORKER').workFailureProbability).toBe(0.07);
  });

  it('uses a deterministic policy roll for the same seed/index/salt', () => {
    const a = deterministicPolicyRoll(123, 9, 'work:trash');
    const b = deterministicPolicyRoll(123, 9, 'work:trash');

    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
    expect(deterministicPolicyRoll(123, 10, 'work:trash')).not.toBe(a);
  });

  it.each(BASELINE_ARCHETYPES)(
    '%s turns a 0%/100% explicit failure override into deterministic work success/failure',
    (archetype) => {
      const state = createInitialGameState(balance, 1);

      const success = createBaselinePolicy(
        balance,
        archetype,
        123,
        { workFailureProbability: 0 },
      ).decide({
        state,
        activeAction: null,
        counters: zeroCounters(),
        decisionIndex: 0,
      });

      const failure = createBaselinePolicy(
        balance,
        archetype,
        123,
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

  it('differentiates cautious, growth, aggressive, and worker bankroll behavior', () => {
    const state = {
      ...createInitialGameState(balance, 2),
      cash: 20_000,
    };
    const context = {
      state,
      activeAction: null,
      counters: zeroCounters(),
      decisionIndex: 0,
    };

    const cautious = createBaselinePolicy(
      balance,
      'CAUTIOUS',
      2,
    ).decide(context);
    const growth = createBaselinePolicy(
      balance,
      'BASELINE_GROWTH',
      2,
    ).decide(context);
    const aggressive = createBaselinePolicy(
      balance,
      'AGGRESSIVE',
      2,
    ).decide(context);
    const worker = createBaselinePolicy(
      balance,
      'WORKER',
      2,
    ).decide(context);

    expect(cautious.type).toBe('WORK');
    expect(growth).toEqual({ type: 'PLINKO', fraction: 0.5 });
    expect(aggressive).toEqual({ type: 'PLINKO', fraction: 1 });
    expect(worker.type).toBe('WORK');
  });

  it('prioritizes explicit recovery actions before earning decisions', () => {
    const policy = createBaselinePolicy(
      balance,
      'BASELINE_GROWTH',
      3,
    );

    const lowEnergy = policy.decide({
      state: {
        ...createInitialGameState(balance, 3),
        needs: {
          health: 100,
          satiety: 100,
          energy: 10,
          happiness: 100,
        },
      },
      activeAction: null,
      counters: zeroCounters(),
      decisionIndex: 0,
    });
    expect(lowEnergy.type).toBe('SLEEP');

    const noFoodBuffer = policy.decide({
      state: {
        ...createInitialGameState(balance, 3),
        needs: {
          health: 100,
          satiety: 10,
          energy: 100,
          happiness: 100,
        },
      },
      activeAction: null,
      counters: zeroCounters(),
      decisionIndex: 1,
    });
    expect(noFoodBuffer.type).toBe('DUMPSTER');

    const smelly = policy.decide({
      state: {
        ...createInitialGameState(balance, 3),
        cash: 500,
        statuses: { SMELLY: true },
      },
      activeAction: null,
      counters: zeroCounters(),
      decisionIndex: 2,
    });
    expect(smelly.type).toBe('SHOWER');
  });

  it('pays an event choice only when the policy can preserve its reserve', () => {
    const rich = {
      ...createInitialGameState(balance, 4),
      cash: 100_000,
      pendingEventId: 'EVENT_01',
    };
    const poor = {
      ...createInitialGameState(balance, 4),
      cash: 500,
      pendingEventId: 'EVENT_01',
    };
    const policy = createBaselinePolicy(
      balance,
      'CAUTIOUS',
      4,
    );

    expect(
      policy.decide({
        state: rich,
        activeAction: null,
        counters: zeroCounters(),
        decisionIndex: 0,
      }),
    ).toEqual({ type: 'EVENT_CHOICE', choice: 'a' });

    expect(
      policy.decide({
        state: poor,
        activeAction: null,
        counters: zeroCounters(),
        decisionIndex: 1,
      }),
    ).toEqual({ type: 'EVENT_CHOICE', choice: 'b' });
  });

  it.each(BASELINE_ARCHETYPES)(
    '%s can execute a bounded canonical run without invalid decisions',
    (archetype) => {
      const seed = 10_000 + BASELINE_ARCHETYPES.indexOf(archetype);
      const policy = createBaselinePolicy(
        balance,
        archetype,
        seed,
      );

      const result = runFullGame(
        balance,
        policy,
        fairishPlinko,
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
