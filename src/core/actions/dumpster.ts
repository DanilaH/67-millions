import type { BalanceConfig } from '../../config/balance.schema';
import {
  createActiveAction,
  type ActiveAction,
  type DumpsterActiveAction,
} from '../actions/ActiveAction';
import { creditCash } from '../economy/money';
import type { PendingDrop } from '../plinko-rules/drop';
import { SeededRandom } from '../rng/SeededRandom';
import type { GameState } from '../state/GameState';
import { applyNeedsDelta } from '../state/mutations';

export type DumpsterLootKind =
  | 'EMPTY'
  | 'CHEAP_FOOD'
  | 'CASH'
  | 'SELLABLE_OBJECT'
  | 'RARE_FIND'
  | 'TERMINAL_NO_LOOT';

export interface StartedDumpsterSearch {
  state: GameState;
  action: DumpsterActiveAction;
  energySpent: number;
  happinessSpent: number;
  healthSpent: number;
}

export interface DumpsterResolution {
  state: GameState;
  loot: DumpsterLootKind;
  emptyChance: number | null;
  cashAward: number;
}

type LootRecord = Record<string, string | number | boolean>;

const getLootRecord = (
  config: BalanceConfig,
  key: string,
): LootRecord => {
  const record = config.dumpster.loot[key];
  if (!record) throw new Error(`Missing dumpster loot config: ${key}`);
  return record;
};

const readNumber = (
  record: LootRecord,
  key: string,
  context: string,
): number => {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid dumpster ${context}.${key}`);
  }
  return value;
};

const assertCanStartDumpster = (
  state: GameState,
  activeAction: ActiveAction | null,
  pendingDrop: PendingDrop | null,
): void => {
  if (pendingDrop !== null) {
    throw new Error('Cannot search dumpster while a Drop is pending');
  }
  if (activeAction !== null) {
    throw new Error('Cannot search dumpster while another action is active');
  }
  if (state.terminalReason !== null || state.victory || state.barryInterruptPending) {
    throw new Error('Cannot search dumpster in the current run state');
  }
};

const applyDumpsterStartCost = (
  state: GameState,
  config: BalanceConfig,
): {
  state: GameState;
  energySpent: number;
  happinessSpent: number;
  healthSpent: number;
} => {
  const energySpent = Math.min(state.needs.energy, config.dumpster.energyCost);
  const energyShortfall = config.dumpster.energyCost - energySpent;

  const happinessCost =
    energyShortfall * config.dumpster.energyShortfallToHappiness;
  const happinessSpent = Math.min(state.needs.happiness, happinessCost);
  const happinessShortfall = happinessCost - happinessSpent;

  const healthSpent =
    happinessShortfall * config.dumpster.happinessShortfallToHp;

  const next = applyNeedsDelta(
    state,
    {
      energy: -energySpent,
      happiness: -happinessSpent,
      health: -healthSpent,
    },
    { min: config.needs.min, max: config.needs.max },
  ).state;

  return {
    state: next,
    energySpent,
    happinessSpent,
    healthSpent,
  };
};

export const startDumpsterSearch = (
  state: GameState,
  activeAction: ActiveAction | null,
  pendingDrop: PendingDrop | null,
  config: BalanceConfig,
): StartedDumpsterSearch => {
  assertCanStartDumpster(state, activeAction, pendingDrop);

  const charged = applyDumpsterStartCost(state, config);
  const action = createActiveAction({
    kind: 'DUMPSTER',
    actionId: 'DUMPSTER_SEARCH',
    remainingMinutes: config.dumpster.durationMinutes,
    upfrontApplied: true,
    startedAtGameDayIndex: state.clock.gameDayIndex,
    startedAtMinuteOfDay: state.clock.minuteOfDay,
  }) as DumpsterActiveAction;

  return {
    ...charged,
    action,
  };
};

export const getDumpsterEmptyChance = (
  config: BalanceConfig,
  completedSearchStreak: number,
): number => {
  if (!Number.isInteger(completedSearchStreak) || completedSearchStreak < 0) {
    throw new RangeError('Dumpster search streak must be a non-negative integer');
  }

  const chances = config.dumpster.emptyChanceByConsecutiveSearch;
  const indexed =
    chances[Math.min(completedSearchStreak, chances.length - 1)] ??
    config.dumpster.emptyChanceCap;

  return Math.min(indexed, config.dumpster.emptyChanceCap);
};

const randomIntegerInclusive = (
  rng: SeededRandom,
  min: number,
  max: number,
): number => {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new Error('Dumpster cash range must contain valid integers');
  }
  return min + Math.floor(rng.next() * (max - min + 1));
};

const finishWithRng = (
  state: GameState,
  rng: SeededRandom,
): GameState => ({
  ...state,
  rngState: rng.snapshot().state,
  dumpsterSearchStreak: state.dumpsterSearchStreak + 1,
});

export const settleDumpsterSearch = (
  state: GameState,
  config: BalanceConfig,
): DumpsterResolution => {
  if (state.terminalReason !== null || state.victory) {
    return {
      state,
      loot: 'TERMINAL_NO_LOOT',
      emptyChance: null,
      cashAward: 0,
    };
  }

  if (
    config.dumpster.lootRollMode !==
    'rollEmptyFirstThenNormalizeNonEmptyWeights'
  ) {
    throw new Error('Unsupported dumpster loot roll mode');
  }

  const rng = new SeededRandom(state.rngState);
  const emptyChance = getDumpsterEmptyChance(
    config,
    state.dumpsterSearchStreak,
  );

  if (rng.next() < emptyChance) {
    return {
      state: finishWithRng(state, rng),
      loot: 'EMPTY',
      emptyChance,
      cashAward: 0,
    };
  }

  const categories = [
    ['cheapFood', 'CHEAP_FOOD'],
    ['cash', 'CASH'],
    ['sellableObject', 'SELLABLE_OBJECT'],
    ['rareFind', 'RARE_FIND'],
  ] as const;

  const weighted = categories.map(([key, loot]) => {
    const record = getLootRecord(config, key);
    const weight = readNumber(record, 'conditionalWeight', key);
    if (weight <= 0) {
      throw new Error(`Dumpster conditional weight must be positive: ${key}`);
    }
    return { key, loot, record, weight };
  });

  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng.next() * totalWeight;
  const selected =
    weighted.find((entry) => {
      roll -= entry.weight;
      return roll < 0;
    }) ?? weighted[weighted.length - 1]!;

  if (selected.key === 'cheapFood') {
    const next = applyNeedsDelta(
      state,
      {
        satiety: readNumber(selected.record, 'satiety', selected.key),
        happiness: readNumber(selected.record, 'happiness', selected.key),
        energy: readNumber(selected.record, 'energy', selected.key),
        health: readNumber(selected.record, 'hp', selected.key),
      },
      { min: config.needs.min, max: config.needs.max },
    ).state;

    return {
      state: finishWithRng(next, rng),
      loot: selected.loot,
      emptyChance,
      cashAward: 0,
    };
  }

  const min = readNumber(selected.record, 'min', selected.key);
  const max = readNumber(selected.record, 'max', selected.key);
  const cashAward = randomIntegerInclusive(rng, min, max);
  const credited = {
    ...state,
    cash: creditCash(state.cash, cashAward),
  };

  return {
    state: finishWithRng(credited, rng),
    loot: selected.loot,
    emptyChance,
    cashAward,
  };
};

export const resetDumpsterSearchStreak = (
  state: GameState,
): GameState =>
  state.dumpsterSearchStreak === 0
    ? state
    : { ...state, dumpsterSearchStreak: 0 };
