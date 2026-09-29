import type { BalanceConfig } from '../../src/config/balance.schema';
import { getBarryPaymentDue } from '../../src/core/barry/barry';
import {
  getEventChoiceAvailability,
} from '../../src/core/events/eventEffects';
import {
  calculateActualBet,
  type BetFraction,
} from '../../src/core/plinko-rules/drop';
import { getMaxBetForLevel } from '../../src/core/plinko-rules/progression';
import type { GameState } from '../../src/core/state/GameState';
import { startWork, type JobId } from '../../src/core/work/work';
import type {
  FullGameDecision,
  FullGamePolicy,
  FullGamePolicyContext,
} from './runner';

export type BaselineArchetype =
  | 'CAUTIOUS'
  | 'BASELINE_GROWTH'
  | 'AGGRESSIVE'
  | 'WORKER';

export interface BaselinePolicyProfile {
  archetype: BaselineArchetype;
  version: 'v1';
  workFailureProbability: number;
  reserveMultiplier: number;
  reserveFlat: number;
  betFraction: BetFraction;
  satietyFloor: number;
  energyFloor: number;
  happinessFloor: number;
  preferredFoodId: string;
  preferredEntertainmentId: string;
  workPriority: readonly JobId[];
  allowPlinko: boolean;
  buyJobUpgrades: boolean;
  buyPlinkoMaxBet: boolean;
}

export interface BaselinePolicy extends FullGamePolicy {
  archetype: BaselineArchetype;
  version: 'v1';
  profile: BaselinePolicyProfile;
}

const PROFILES: Record<BaselineArchetype, BaselinePolicyProfile> = {
  CAUTIOUS: {
    archetype: 'CAUTIOUS',
    version: 'v1',
    workFailureProbability: 0.05,
    reserveMultiplier: 2.5,
    reserveFlat: 4_000,
    betFraction: 0.25,
    satietyFloor: 45,
    energyFloor: 45,
    happinessFloor: 35,
    preferredFoodId: 'FOOD_03',
    preferredEntertainmentId: 'FREE_FUN',
    workPriority: ['courier', 'trash', 'dishes'],
    allowPlinko: true,
    buyJobUpgrades: true,
    buyPlinkoMaxBet: false,
  },
  BASELINE_GROWTH: {
    archetype: 'BASELINE_GROWTH',
    version: 'v1',
    workFailureProbability: 0.08,
    reserveMultiplier: 1.75,
    reserveFlat: 2_500,
    betFraction: 0.5,
    satietyFloor: 35,
    energyFloor: 35,
    happinessFloor: 25,
    preferredFoodId: 'FOOD_04',
    preferredEntertainmentId: 'PC_CLUB',
    workPriority: ['courier', 'trash', 'dishes'],
    allowPlinko: true,
    buyJobUpgrades: true,
    buyPlinkoMaxBet: true,
  },
  AGGRESSIVE: {
    archetype: 'AGGRESSIVE',
    version: 'v1',
    workFailureProbability: 0.12,
    reserveMultiplier: 1.15,
    reserveFlat: 1_000,
    betFraction: 1,
    satietyFloor: 25,
    energyFloor: 25,
    happinessFloor: 15,
    preferredFoodId: 'FOOD_02',
    preferredEntertainmentId: 'FREE_FUN',
    workPriority: ['courier', 'dishes', 'trash'],
    allowPlinko: true,
    buyJobUpgrades: false,
    buyPlinkoMaxBet: true,
  },
  WORKER: {
    archetype: 'WORKER',
    version: 'v1',
    workFailureProbability: 0.07,
    reserveMultiplier: 2,
    reserveFlat: 3_000,
    betFraction: 0.25,
    satietyFloor: 40,
    energyFloor: 40,
    happinessFloor: 30,
    preferredFoodId: 'FOOD_03',
    preferredEntertainmentId: 'FREE_FUN',
    workPriority: ['courier', 'trash', 'dishes'],
    allowPlinko: false,
    buyJobUpgrades: true,
    buyPlinkoMaxBet: false,
  },
};

const mix32 = (value: number): number => {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
};

const stringSalt = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const deterministicPolicyRoll = (
  seed: number,
  decisionIndex: number,
  salt: string,
): number => {
  const mixed = mix32(
    (seed >>> 0) ^
      Math.imul((decisionIndex + 1) >>> 0, 0x9e3779b1) ^
      stringSalt(salt),
  );
  return mixed / 0x1_0000_0000;
};

export const getBaselinePolicyProfile = (
  archetype: BaselineArchetype,
): BaselinePolicyProfile => PROFILES[archetype];

const reserveTarget = (
  state: GameState,
  config: BalanceConfig,
  profile: BaselinePolicyProfile,
): number =>
  Math.round(
    getBarryPaymentDue(state, config) * profile.reserveMultiplier +
      profile.reserveFlat,
  );

const canAffordAboveReserve = (
  state: GameState,
  price: number,
  reserve: number,
): boolean => state.cash >= price && state.cash - price >= reserve;

const nextJobUpgrade = (
  state: GameState,
  config: BalanceConfig,
  jobId: JobId,
) =>
  config.work.jobs[jobId].levels.find(
    (entry) => entry.level === state.jobLevels[jobId] + 1,
  ) ?? null;

const chooseJobUpgrade = (
  state: GameState,
  config: BalanceConfig,
  profile: BaselinePolicyProfile,
  reserve: number,
): FullGameDecision | null => {
  if (!profile.buyJobUpgrades) return null;

  for (const jobId of profile.workPriority) {
    const next = nextJobUpgrade(state, config, jobId);
    if (
      next !== null &&
      canAffordAboveReserve(state, next.upgradePrice, reserve)
    ) {
      return { type: 'BUY_JOB_UPGRADE', jobId };
    }
  }

  return null;
};

const chooseGrowthEvUpgrade = (
  state: GameState,
  config: BalanceConfig,
  reserve: number,
): FullGameDecision | null => {
  if (state.eventModifiers.plinkoLockRemainingMinutes > 0) {
    return null;
  }

  const pocketCandidate = (
    track: 'center' | 'mid' | 'jackpot',
    currentLevel: number,
    levels: readonly { level: number; price: number }[],
  ): FullGameDecision | null => {
    const next = levels.find((entry) => entry.level === currentLevel + 1);
    return next !== undefined &&
      canAffordAboveReserve(state, next.price, reserve)
      ? { type: 'BUY_PLINKO_POCKET', track }
      : null;
  };

  const specialCandidate = (
    track: 'amplifier' | 'return' | 'splitter' | 'jackpotBias',
    currentLevel: number,
    levels: readonly { level: number; price: number }[],
  ): FullGameDecision | null => {
    const next = levels.find((entry) => entry.level === currentLevel + 1);
    return next !== undefined &&
      canAffordAboveReserve(state, next.price, reserve)
      ? { type: 'BUY_PLINKO_SPECIAL', track }
      : null;
  };

  return (
    pocketCandidate(
      'center',
      state.plinkoCenterLevel,
      config.plinko.centerUpgrades,
    ) ??
    pocketCandidate(
      'mid',
      state.plinkoMidLevel,
      config.plinko.midUpgrades,
    ) ??
    specialCandidate(
      'jackpotBias',
      state.plinkoJackpotBiasLevel,
      config.plinko.jackpotBias,
    ) ??
    specialCandidate(
      'amplifier',
      state.plinkoAmplifierLevel,
      config.plinko.amplifier,
    ) ??
    specialCandidate(
      'return',
      state.plinkoReturnLevel,
      config.plinko.return,
    ) ??
    pocketCandidate(
      'jackpot',
      state.plinkoJackpotLevel,
      config.plinko.jackpotUpgrades,
    )
  );
};

const chooseBetFractionAboveReserve = (
  state: GameState,
  config: BalanceConfig,
  preferred: BetFraction,
  reserve: number,
): BetFraction | null => {
  if (state.cash <= 0) return null;

  const candidates: readonly BetFraction[] =
    preferred === 1
      ? [1, 0.5, 0.25]
      : preferred === 0.5
        ? [0.5, 0.25]
        : [0.25];
  const maxBet = getMaxBetForLevel(
    config,
    state.plinkoMaxBetLevel,
  );

  for (const fraction of candidates) {
    const stake = calculateActualBet(
      state.cash,
      maxBet,
      fraction,
    );
    if (state.cash - stake >= reserve) {
      return fraction;
    }
  }

  return null;
};

const chooseMaxBetUpgrade = (
  state: GameState,
  config: BalanceConfig,
  profile: BaselinePolicyProfile,
  reserve: number,
): FullGameDecision | null => {
  if (
    !profile.buyPlinkoMaxBet ||
    state.eventModifiers.plinkoLockRemainingMinutes > 0
  ) return null;

  const next = config.plinko.maxBetLevels.find(
    (entry) => entry.level === state.plinkoMaxBetLevel + 1,
  );
  if (
    next !== undefined &&
    canAffordAboveReserve(state, next.price, reserve)
  ) {
    return { type: 'BUY_PLINKO_MAX_BET' };
  }

  return null;
};

const chooseAvailableWork = (
  state: GameState,
  config: BalanceConfig,
  profile: BaselinePolicyProfile,
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

    const failed =
      deterministicPolicyRoll(
        seed,
        decisionIndex,
        `work:${profile.archetype}:${jobId}`,
      ) < profile.workFailureProbability;

    return {
      type: 'WORK',
      jobId,
      level,
      result: failed ? 'FAILURE' : 'SUCCESS',
    };
  }

  return null;
};

const chooseEvent = (
  state: GameState,
  config: BalanceConfig,
  reserve: number,
): FullGameDecision => {
  const eventId = state.pendingEventId;
  if (eventId === null) {
    throw new Error('chooseEvent requires pendingEventId');
  }

  const a = getEventChoiceAvailability(
    state,
    config,
    eventId,
    'a',
  );

  if (a.available && state.cash - a.cashCost >= reserve) {
    return { type: 'EVENT_CHOICE', choice: 'a' };
  }

  return { type: 'EVENT_CHOICE', choice: 'b' };
};

const chooseRecovery = (
  state: GameState,
  config: BalanceConfig,
  profile: BaselinePolicyProfile,
  _reserve: number,
): FullGameDecision | null => {
  if (state.statuses.SMELLY && state.cash >= 300) {
    return { type: 'SHOWER' };
  }

  if (state.needs.satiety < profile.satietyFloor) {
    const food = config.food.find(
      (entry) => entry.id === profile.preferredFoodId,
    );
    const multiplier =
      state.eventModifiers.foodPriceMultiplier?.multiplier ?? 1;
    const price =
      food === undefined
        ? Number.POSITIVE_INFINITY
        : Math.round(food.price * multiplier);

    return state.cash >= price
      ? { type: 'FOOD', id: profile.preferredFoodId }
      : { type: 'DUMPSTER' };
  }

  if (state.needs.happiness < profile.happinessFloor) {
    const entertainment = config.entertainment.find(
      (entry) => entry.id === profile.preferredEntertainmentId,
    );
    const price = entertainment?.price ?? Number.POSITIVE_INFINITY;

    return state.cash >= price
      ? {
          type: 'ENTERTAINMENT',
          id: profile.preferredEntertainmentId,
        }
      : { type: 'ENTERTAINMENT', id: 'FREE_FUN' };
  }

  if (
    state.needs.health <= 35 ||
    state.needs.energy < profile.energyFloor
  ) {
    return { type: 'SLEEP' };
  }

  return null;
};

const createDecisionFunction = (
  config: BalanceConfig,
  profile: BaselinePolicyProfile,
  seed: number,
) =>
  ({ state, decisionIndex }: FullGamePolicyContext): FullGameDecision => {
    const reserve = reserveTarget(state, config, profile);

    if (state.pendingEventId !== null) {
      return chooseEvent(state, config, reserve);
    }

    if (state.cash >= state.mainDebt) {
      return { type: 'PAY_MAIN_DEBT' };
    }

    const recovery = chooseRecovery(state, config, profile, reserve);
    if (recovery !== null) return recovery;

    if (profile.archetype === 'BASELINE_GROWTH') {
      const evUpgrade = chooseGrowthEvUpgrade(
        state,
        config,
        reserve,
      );
      if (evUpgrade !== null) return evUpgrade;
    }

    const jobUpgrade = chooseJobUpgrade(
      state,
      config,
      profile,
      reserve,
    );
    if (jobUpgrade !== null) return jobUpgrade;

    const maxBetUpgrade = chooseMaxBetUpgrade(
      state,
      config,
      profile,
      reserve,
    );
    if (maxBetUpgrade !== null) return maxBetUpgrade;

    const work = chooseAvailableWork(
      state,
      config,
      profile,
      seed,
      decisionIndex,
    );

    const excessCash = state.cash - reserve;
    const safeBetFraction =
      profile.allowPlinko &&
      state.eventModifiers.plinkoLockRemainingMinutes <= 0 &&
      excessCash > 0
        ? chooseBetFractionAboveReserve(
            state,
            config,
            profile.betFraction,
            reserve,
          )
        : null;

    if (
      safeBetFraction !== null &&
      (profile.archetype === 'AGGRESSIVE' ||
        profile.archetype === 'BASELINE_GROWTH')
    ) {
      return {
        type: 'PLINKO',
        fraction: safeBetFraction,
      };
    }

    if (work !== null) return work;

    if (safeBetFraction !== null) {
      return {
        type: 'PLINKO',
        fraction: safeBetFraction,
      };
    }

    return { type: 'WAIT', minutes: 60 };
  };

export const createBaselinePolicy = (
  config: BalanceConfig,
  archetype: BaselineArchetype,
  seed: number,
  overrides: Partial<
    Pick<BaselinePolicyProfile, 'workFailureProbability'>
  > = {},
): BaselinePolicy => {
  if (!Number.isInteger(seed) || seed <= 0) {
    throw new RangeError('Baseline policy seed must be a positive integer');
  }

  const base = PROFILES[archetype];
  const profile: BaselinePolicyProfile = {
    ...base,
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

export const BASELINE_ARCHETYPES: readonly BaselineArchetype[] = [
  'CAUTIOUS',
  'BASELINE_GROWTH',
  'AGGRESSIVE',
  'WORKER',
];
