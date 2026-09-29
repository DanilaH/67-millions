import type { BalanceConfig } from '../../src/config/balance.schema';
import { getBarryPaymentDue } from '../../src/core/barry/barry';
import {
  getEventChoiceAvailability,
} from '../../src/core/events/eventEffects';
import type { GameState } from '../../src/core/state/GameState';
import { startWork, type JobId } from '../../src/core/work/work';
import {
  deterministicPolicyRoll,
} from './policies';
import type {
  FullGameDecision,
  FullGamePolicy,
  FullGamePolicyContext,
} from './runner';

export type HighVarianceArchetype =
  | 'DEGENERATE'
  | 'RECKLESS_NEEDS';

export interface HighVariancePolicyProfile {
  archetype: HighVarianceArchetype;
  version: 'v1';
  workFailureProbability: number;
  reserveMultiplier: number;
  reserveFlat: number;
  criticalHealth: number;
  criticalSatiety: number;
  criticalEnergy: number;
  criticalHappiness: number;
  workPriority: readonly JobId[];
}

export interface HighVariancePolicy extends FullGamePolicy {
  archetype: HighVarianceArchetype;
  version: 'v1';
  profile: HighVariancePolicyProfile;
}

const PROFILES: Record<
  HighVarianceArchetype,
  HighVariancePolicyProfile
> = {
  DEGENERATE: {
    archetype: 'DEGENERATE',
    version: 'v1',
    workFailureProbability: 0.14,
    reserveMultiplier: 0.9,
    reserveFlat: 500,
    criticalHealth: 18,
    criticalSatiety: 18,
    criticalEnergy: 18,
    criticalHappiness: 10,
    workPriority: ['courier', 'dishes', 'trash'],
  },
  RECKLESS_NEEDS: {
    archetype: 'RECKLESS_NEEDS',
    version: 'v1',
    workFailureProbability: 0.16,
    reserveMultiplier: 0.75,
    reserveFlat: 250,
    criticalHealth: 15,
    criticalSatiety: 8,
    criticalEnergy: 8,
    criticalHappiness: 5,
    workPriority: ['courier', 'dishes', 'trash'],
  },
};

export const HIGH_VARIANCE_ARCHETYPES: readonly HighVarianceArchetype[] = [
  'DEGENERATE',
  'RECKLESS_NEEDS',
];

export const getHighVariancePolicyProfile = (
  archetype: HighVarianceArchetype,
): HighVariancePolicyProfile => PROFILES[archetype];

const reserveTarget = (
  state: GameState,
  config: BalanceConfig,
  profile: HighVariancePolicyProfile,
): number =>
  Math.round(
    getBarryPaymentDue(state, config) * profile.reserveMultiplier +
      profile.reserveFlat,
  );

const canSpend = (
  state: GameState,
  price: number,
  reserve: number,
): boolean => state.cash >= price && state.cash - price >= reserve;

const nextPrice = <T extends { level: number; price: number }>(
  levels: readonly T[],
  currentLevel: number,
): number | null =>
  levels.find((entry) => entry.level === currentLevel + 1)?.price ?? null;

const chooseDegenerateUpgrade = (
  state: GameState,
  config: BalanceConfig,
  reserve: number,
): FullGameDecision | null => {
  const biasPrice = nextPrice(
    config.plinko.jackpotBias,
    state.plinkoJackpotBiasLevel,
  );
  if (
    biasPrice !== null &&
    canSpend(state, biasPrice, reserve)
  ) {
    return {
      type: 'BUY_PLINKO_SPECIAL',
      track: 'jackpotBias',
    };
  }

  const splitterPrice = nextPrice(
    config.plinko.splitter,
    state.plinkoSplitterLevel,
  );
  if (
    splitterPrice !== null &&
    canSpend(state, splitterPrice, reserve)
  ) {
    return {
      type: 'BUY_PLINKO_SPECIAL',
      track: 'splitter',
    };
  }

  const jackpotPrice = nextPrice(
    config.plinko.jackpotUpgrades,
    state.plinkoJackpotLevel,
  );
  if (
    jackpotPrice !== null &&
    canSpend(state, jackpotPrice, reserve)
  ) {
    return {
      type: 'BUY_PLINKO_POCKET',
      track: 'jackpot',
    };
  }

  const maxBetPrice = nextPrice(
    config.plinko.maxBetLevels,
    state.plinkoMaxBetLevel,
  );
  if (
    maxBetPrice !== null &&
    canSpend(state, maxBetPrice, reserve)
  ) {
    return { type: 'BUY_PLINKO_MAX_BET' };
  }

  return null;
};

const chooseRecklessUpgrade = (
  state: GameState,
  config: BalanceConfig,
  reserve: number,
): FullGameDecision | null => {
  const maxBetPrice = nextPrice(
    config.plinko.maxBetLevels,
    state.plinkoMaxBetLevel,
  );
  if (
    maxBetPrice !== null &&
    canSpend(state, maxBetPrice, reserve)
  ) {
    return { type: 'BUY_PLINKO_MAX_BET' };
  }

  const amplifierPrice = nextPrice(
    config.plinko.amplifier,
    state.plinkoAmplifierLevel,
  );
  if (
    amplifierPrice !== null &&
    canSpend(state, amplifierPrice, reserve)
  ) {
    return {
      type: 'BUY_PLINKO_SPECIAL',
      track: 'amplifier',
    };
  }

  return null;
};

const chooseAvailableWork = (
  state: GameState,
  config: BalanceConfig,
  profile: HighVariancePolicyProfile,
  seed: number,
  decisionIndex: number,
): FullGameDecision | null => {
  for (const jobId of profile.workPriority) {
    const level = state.jobLevels[jobId];

    try {
      startWork(state, config, jobId, level);
    } catch {
      continue;
    }

    const failure =
      deterministicPolicyRoll(
        seed,
        decisionIndex,
        `work:${profile.archetype}:${jobId}`,
      ) < profile.workFailureProbability;

    return {
      type: 'WORK',
      jobId,
      level,
      result: failure ? 'FAILURE' : 'SUCCESS',
    };
  }

  return null;
};

const chooseEvent = (
  state: GameState,
  config: BalanceConfig,
  archetype: HighVarianceArchetype,
  reserve: number,
): FullGameDecision => {
  const eventId = state.pendingEventId;
  if (eventId === null) throw new Error('Pending event required');

  const pay = getEventChoiceAvailability(
    state,
    config,
    eventId,
    'a',
  );

  if (
    archetype === 'DEGENERATE' &&
    pay.available &&
    pay.cashCost <= state.cash * 0.08 &&
    state.cash - pay.cashCost >= reserve
  ) {
    return { type: 'EVENT_CHOICE', choice: 'a' };
  }

  return { type: 'EVENT_CHOICE', choice: 'b' };
};

const chooseCriticalRecovery = (
  state: GameState,
  config: BalanceConfig,
  profile: HighVariancePolicyProfile,
  reserve: number,
): FullGameDecision | null => {
  if (
    state.needs.health <= profile.criticalHealth ||
    state.needs.energy <= profile.criticalEnergy
  ) {
    return { type: 'SLEEP' };
  }

  if (state.needs.satiety <= profile.criticalSatiety) {
    if (profile.archetype === 'RECKLESS_NEEDS') {
      return { type: 'DUMPSTER' };
    }

    const food = config.food.find(
      (entry) => entry.id === 'FOOD_02',
    );
    const multiplier =
      state.eventModifiers.foodPriceMultiplier?.multiplier ?? 1;
    const price =
      food === undefined
        ? Number.POSITIVE_INFINITY
        : Math.round(food.price * multiplier);

    return canSpend(state, price, reserve)
      ? { type: 'FOOD', id: 'FOOD_02' }
      : { type: 'DUMPSTER' };
  }

  if (state.needs.happiness <= profile.criticalHappiness) {
    return { type: 'ENTERTAINMENT', id: 'FREE_FUN' };
  }

  return null;
};

const createDecisionFunction = (
  config: BalanceConfig,
  profile: HighVariancePolicyProfile,
  seed: number,
) =>
  ({ state, decisionIndex }: FullGamePolicyContext): FullGameDecision => {
    const reserve = reserveTarget(state, config, profile);

    if (state.pendingEventId !== null) {
      return chooseEvent(
        state,
        config,
        profile.archetype,
        reserve,
      );
    }

    if (state.cash >= state.mainDebt) {
      return { type: 'PAY_MAIN_DEBT' };
    }

    const recovery = chooseCriticalRecovery(
      state,
      config,
      profile,
      reserve,
    );
    if (recovery !== null) return recovery;

    const upgrade =
      profile.archetype === 'DEGENERATE'
        ? chooseDegenerateUpgrade(state, config, reserve)
        : chooseRecklessUpgrade(state, config, reserve);
    if (upgrade !== null) return upgrade;

    const excessCash = state.cash - reserve;
    if (
      excessCash > 0 &&
      state.eventModifiers.plinkoLockRemainingMinutes <= 0
    ) {
      return { type: 'PLINKO', fraction: 1 };
    }

    const work = chooseAvailableWork(
      state,
      config,
      profile,
      seed,
      decisionIndex,
    );
    if (work !== null) return work;

    return { type: 'WAIT', minutes: 60 };
  };

export const createHighVariancePolicy = (
  config: BalanceConfig,
  archetype: HighVarianceArchetype,
  seed: number,
  overrides: Partial<
    Pick<HighVariancePolicyProfile, 'workFailureProbability'>
  > = {},
): HighVariancePolicy => {
  if (!Number.isInteger(seed) || seed <= 0) {
    throw new RangeError(
      'High-variance policy seed must be a positive integer',
    );
  }

  const profile: HighVariancePolicyProfile = {
    ...PROFILES[archetype],
    ...overrides,
  };

  if (
    profile.workFailureProbability < 0 ||
    profile.workFailureProbability > 1
  ) {
    throw new RangeError(
      'workFailureProbability must be within [0, 1]',
    );
  }

  return {
    id: `${archetype.toLowerCase()}-v1-fail${profile.workFailureProbability}`,
    archetype,
    version: 'v1',
    profile,
    decide: createDecisionFunction(config, profile, seed),
  };
};
