import type { BalanceConfig } from '../../config/balance.schema';
import { debitCash } from '../economy/money';
import type { GameState } from '../state/GameState';
import type { PendingDrop } from './drop';

export interface PocketUpgradeLevels {
  centerLevel: number;
  midLevel: number;
  jackpotLevel: number;
}

export interface SpecialUpgradeLevels {
  amplifierLevel: number;
  returnLevel: number;
  splitterLevel: number;
  jackpotBiasLevel: number;
}

export type PocketUpgradeTrack = 'center' | 'mid' | 'jackpot';
export type SpecialUpgradeTrack =
  | 'amplifier'
  | 'return'
  | 'splitter'
  | 'jackpotBias';

const getLevel = <T extends { level: number }>(
  levels: readonly T[],
  level: number,
  name: string,
): T | null => {
  if (level === 0) return null;
  const entry = levels.find((candidate) => candidate.level === level);
  if (!entry) throw new RangeError(`Unknown ${name} level ${level}`);
  return entry;
};

const setPair = (
  pockets: number[],
  pair: readonly [number, number],
  value: number,
): void => {
  pockets[pair[0]] = value;
  pockets[pair[1]] = value;
};

export const getPocketUpgradeLevels = (
  state: GameState,
): PocketUpgradeLevels => ({
  centerLevel: state.plinkoCenterLevel,
  midLevel: state.plinkoMidLevel,
  jackpotLevel: state.plinkoJackpotLevel,
});

export const getSpecialUpgradeLevels = (
  state: GameState,
): SpecialUpgradeLevels => ({
  amplifierLevel: state.plinkoAmplifierLevel,
  returnLevel: state.plinkoReturnLevel,
  splitterLevel: state.plinkoSplitterLevel,
  jackpotBiasLevel: state.plinkoJackpotBiasLevel,
});

export const derivePocketMultipliers = (
  config: BalanceConfig,
  levels: PocketUpgradeLevels,
): number[] => {
  const pockets = [...config.plinko.basePockets];
  const families = config.plinko.pocketFamilies;

  const center = getLevel(
    config.plinko.centerUpgrades,
    levels.centerLevel,
    'center upgrade',
  );
  const mid = getLevel(
    config.plinko.midUpgrades,
    levels.midLevel,
    'mid upgrade',
  );
  const jackpot = getLevel(
    config.plinko.jackpotUpgrades,
    levels.jackpotLevel,
    'jackpot upgrade',
  );

  if (center) setPair(pockets, families.center, center.center);
  if (mid) setPair(pockets, families.mid, mid.mid);
  if (jackpot) setPair(pockets, families.edge, jackpot.edge);

  const innerBase = Math.max(
    config.plinko.basePockets[families.inner[0]]!,
    config.plinko.basePockets[families.inner[1]]!,
  );
  const inner = Math.max(
    innerBase,
    center?.inner ?? innerBase,
    mid?.inner ?? innerBase,
  );
  setPair(pockets, families.inner, inner);

  return pockets;
};

export const getMaxBetForLevel = (
  config: BalanceConfig,
  level: number,
): number => {
  const entry = config.plinko.maxBetLevels.find(
    (candidate) => candidate.level === level,
  );
  if (!entry) throw new RangeError(`Unknown max-bet level ${level}`);
  return entry.maxBet;
};

const assertPurchasable = (
  state: GameState,
  pendingDrop: PendingDrop | null,
): void => {
  if (pendingDrop !== null) {
    throw new Error('Cannot buy Plinko upgrades while a Drop is pending');
  }
  if (state.barryInterruptPending) {
    throw new Error('Cannot buy Plinko upgrades while Barry is pending');
  }
  if (state.terminalReason !== null || state.victory) {
    throw new Error('Cannot buy Plinko upgrades after the run has ended');
  }
};

const buy = (
  state: GameState,
  price: number,
  mutate: (state: GameState) => GameState,
): GameState => mutate({ ...state, cash: debitCash(state.cash, price) });

export const purchasePocketUpgrade = (
  state: GameState,
  pendingDrop: PendingDrop | null,
  config: BalanceConfig,
  track: PocketUpgradeTrack,
): GameState => {
  assertPurchasable(state, pendingDrop);

  if (track === 'center') {
    const next = config.plinko.centerUpgrades.find(
      (entry) => entry.level === state.plinkoCenterLevel + 1,
    );
    if (!next) throw new Error('Center pocket track is already maxed');
    return buy(state, next.price, (paid) => ({
      ...paid,
      plinkoCenterLevel: next.level,
    }));
  }

  if (track === 'mid') {
    const next = config.plinko.midUpgrades.find(
      (entry) => entry.level === state.plinkoMidLevel + 1,
    );
    if (!next) throw new Error('Mid pocket track is already maxed');
    return buy(state, next.price, (paid) => ({
      ...paid,
      plinkoMidLevel: next.level,
    }));
  }

  const next = config.plinko.jackpotUpgrades.find(
    (entry) => entry.level === state.plinkoJackpotLevel + 1,
  );
  if (!next) throw new Error('Jackpot pocket track is already maxed');
  return buy(state, next.price, (paid) => ({
    ...paid,
    plinkoJackpotLevel: next.level,
  }));
};

export const purchaseMaxBetUpgrade = (
  state: GameState,
  pendingDrop: PendingDrop | null,
  config: BalanceConfig,
): GameState => {
  assertPurchasable(state, pendingDrop);
  const next = config.plinko.maxBetLevels.find(
    (entry) => entry.level === state.plinkoMaxBetLevel + 1,
  );
  if (!next) throw new Error('Max-bet track is already maxed');

  return buy(state, next.price, (paid) => ({
    ...paid,
    plinkoMaxBetLevel: next.level,
  }));
};


export const getAmplifierUpgrade = (
  config: BalanceConfig,
  level: number,
) => getLevel(config.plinko.amplifier, level, 'Amplifier');

export const getReturnUpgrade = (
  config: BalanceConfig,
  level: number,
) => getLevel(config.plinko.return, level, 'Return');

export const getSplitterUpgrade = (
  config: BalanceConfig,
  level: number,
) => getLevel(config.plinko.splitter, level, 'Splitter');

export const getJackpotBiasUpgrade = (
  config: BalanceConfig,
  level: number,
) => getLevel(config.plinko.jackpotBias, level, 'Jackpot Bias');

export const getInsuranceUpgrade = (
  config: BalanceConfig,
  level: number,
) => getLevel(config.plinko.insurance, level, 'Insurance');

export const purchaseSpecialUpgrade = (
  state: GameState,
  pendingDrop: PendingDrop | null,
  config: BalanceConfig,
  track: SpecialUpgradeTrack,
): GameState => {
  assertPurchasable(state, pendingDrop);

  if (track === 'amplifier') {
    const next = config.plinko.amplifier.find(
      (entry) => entry.level === state.plinkoAmplifierLevel + 1,
    );
    if (!next) throw new Error('Amplifier track is already maxed');
    return buy(state, next.price, (paid) => ({
      ...paid,
      plinkoAmplifierLevel: next.level,
    }));
  }

  if (track === 'return') {
    const next = config.plinko.return.find(
      (entry) => entry.level === state.plinkoReturnLevel + 1,
    );
    if (!next) throw new Error('Return track is already maxed');
    return buy(state, next.price, (paid) => ({
      ...paid,
      plinkoReturnLevel: next.level,
    }));
  }

  if (track === 'splitter') {
    const next = config.plinko.splitter.find(
      (entry) => entry.level === state.plinkoSplitterLevel + 1,
    );
    if (!next) throw new Error('Splitter track is already maxed');
    return buy(state, next.price, (paid) => ({
      ...paid,
      plinkoSplitterLevel: next.level,
    }));
  }

  const next = config.plinko.jackpotBias.find(
    (entry) => entry.level === state.plinkoJackpotBiasLevel + 1,
  );
  if (!next) throw new Error('Jackpot Bias track is already maxed');
  return buy(state, next.price, (paid) => ({
    ...paid,
    plinkoJackpotBiasLevel: next.level,
  }));
};


export const purchaseInsuranceUpgrade = (
  state: GameState,
  pendingDrop: PendingDrop | null,
  config: BalanceConfig,
): GameState => {
  assertPurchasable(state, pendingDrop);

  const next = config.plinko.insurance.find(
    (entry) => entry.level === state.plinkoInsuranceLevel + 1,
  );
  if (!next) throw new Error('Insurance track is already maxed');

  return buy(state, next.price, (paid) => ({
    ...paid,
    plinkoInsuranceLevel: next.level,
  }));
};
