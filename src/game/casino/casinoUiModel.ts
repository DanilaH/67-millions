import type { BalanceConfig } from '../../config/balance.schema';
import {
  calculateActualBet,
  type BetFraction,
  type PendingDrop,
} from '../../core/plinko-rules/drop';
import {
  getMaxBetForLevel,
  derivePocketMultipliers,
  getPocketUpgradeLevels,
  purchaseInsuranceUpgrade,
  purchaseMaxBetUpgrade,
  purchasePocketUpgrade,
  purchaseSpecialUpgrade,
  type PocketUpgradeTrack,
  type SpecialUpgradeTrack,
} from '../../core/plinko-rules/progression';
import { getReturnPins } from '../../core/plinko-rules/specialPinLayout';
import type { GameState } from '../../core/state/GameState';

export interface CasinoQuickBetPreview {
  fraction: BetFraction;
  label: string;
  amount: number | null;
  selected: boolean;
  lockedReason: string | null;
}

export type CasinoUpgradeId =
  | 'maxBet'
  | PocketUpgradeTrack
  | SpecialUpgradeTrack
  | 'insurance';

export interface CasinoUpgradePreview {
  id: CasinoUpgradeId;
  title: string;
  currentLevel: number;
  maxLevel: number;
  nextPrice: number | null;
  detail: string;
  nextEffect: string;
  maxed: boolean;
  lockedReason: string | null;
}

const translateCasinoError = (error: unknown): string => {
  const message =
    error instanceof Error ? error.message : String(error);

  if (message.includes('Drop is pending')) {
    return 'DROP ИДЁТ — ЗАБЛОКИРОВАНО';
  }
  if (message.includes('event-locked')) {
    return 'PLINKO ВРЕМЕННО ЗАБЛОКИРОВАНО';
  }
  if (message.includes('Barry is pending')) {
    return 'СНАЧАЛА ЗАПЛАТИ БАРРИ';
  }
  if (message.includes('run has ended')) {
    return 'ЗАБЕГ ЗАВЕРШЁН';
  }
  if (message.includes('Insufficient cash')) {
    return 'НЕ ХВАТАЕТ ДЕНЕГ';
  }
  if (message.includes('already maxed')) {
    return 'МАКСИМУМ';
  }

  return message;
};

const validate = (run: () => void): string | null => {
  try {
    run();
    return null;
  } catch (error: unknown) {
    return translateCasinoError(error);
  }
};

const quickBetLock = (
  state: GameState,
  pendingDrop: PendingDrop | null,
): string | null => {
  if (pendingDrop !== null) {
    return 'DROP ИДЁТ — НОВАЯ СТАВКА ЗАБЛОКИРОВАНА';
  }
  if (state.barryInterruptPending) {
    return 'СНАЧАЛА ЗАПЛАТИ БАРРИ';
  }
  if (state.terminalReason !== null || state.victory) {
    return 'ЗАБЕГ ЗАВЕРШЁН';
  }
  if (state.eventModifiers.plinkoLockRemainingMinutes > 0) {
    return 'PLINKO ВРЕМЕННО ЗАБЛОКИРОВАНО';
  }
  if (state.cash <= 0) {
    return 'НЕТ ДЕНЕГ ДЛЯ СТАВКИ';
  }
  return null;
};

export const buildCasinoQuickBets = (
  state: GameState,
  pendingDrop: PendingDrop | null,
  config: BalanceConfig,
): CasinoQuickBetPreview[] => {
  const lock = quickBetLock(state, pendingDrop);
  const maxBet = getMaxBetForLevel(
    config,
    state.plinkoMaxBetLevel,
  );

  return (config.plinko.quickBetFractions as BetFraction[]).map(
    (fraction) => ({
      fraction,
      label: `${fraction * 100}%`,
      amount:
        lock === null
          ? calculateActualBet(
              state.cash,
              maxBet,
              fraction,
            )
          : null,
      selected:
        state.plinkoSelectedBetFraction === fraction,
      lockedReason: lock,
    }),
  );
};

interface UpgradeSpec {
  id: CasinoUpgradeId;
  title: string;
  currentLevel: (state: GameState) => number;
  levels: (config: BalanceConfig) => readonly {
    level: number;
    price: number;
  }[];
  validate: (
    state: GameState,
    pendingDrop: PendingDrop | null,
    config: BalanceConfig,
  ) => void;
  detail: (
    state: GameState,
    config: BalanceConfig,
  ) => string;
}

const SPECS: readonly UpgradeSpec[] = [
  {
    id: 'maxBet',
    title: 'Лимит ставки',
    currentLevel: (state) => state.plinkoMaxBetLevel,
    levels: (config) => config.plinko.maxBetLevels,
    validate: (state, pending, config) => {
      purchaseMaxBetUpgrade(state, pending, config);
    },
    detail: (state, config) =>
      `лимит ${getMaxBetForLevel(
        config,
        state.plinkoMaxBetLevel,
      ).toLocaleString('ru-RU')} ₽`,
  },
  {
    id: 'center',
    title: 'Центр',
    currentLevel: (state) => state.plinkoCenterLevel,
    levels: (config) => config.plinko.centerUpgrades,
    validate: (state, pending, config) => {
      purchasePocketUpgrade(
        state,
        pending,
        config,
        'center',
      );
    },
    detail: (state) => `центр L${state.plinkoCenterLevel}`,
  },
  {
    id: 'mid',
    title: 'Середина',
    currentLevel: (state) => state.plinkoMidLevel,
    levels: (config) => config.plinko.midUpgrades,
    validate: (state, pending, config) => {
      purchasePocketUpgrade(
        state,
        pending,
        config,
        'mid',
      );
    },
    detail: (state) => `середина L${state.plinkoMidLevel}`,
  },
  {
    id: 'jackpot',
    title: 'Крайние карманы',
    currentLevel: (state) => state.plinkoJackpotLevel,
    levels: (config) => config.plinko.jackpotUpgrades,
    validate: (state, pending, config) => {
      purchasePocketUpgrade(
        state,
        pending,
        config,
        'jackpot',
      );
    },
    detail: (state) => `края L${state.plinkoJackpotLevel}`,
  },
  {
    id: 'amplifier',
    title: 'Усилитель',
    currentLevel: (state) => state.plinkoAmplifierLevel,
    levels: (config) => config.plinko.amplifier,
    validate: (state, pending, config) => {
      purchaseSpecialUpgrade(
        state,
        pending,
        config,
        'amplifier',
      );
    },
    detail: (state) => `L${state.plinkoAmplifierLevel}`,
  },
  {
    id: 'return',
    title: 'Возврат',
    currentLevel: (state) => state.plinkoReturnLevel,
    levels: (config) => config.plinko.return,
    validate: (state, pending, config) => {
      purchaseSpecialUpgrade(
        state,
        pending,
        config,
        'return',
      );
    },
    detail: (state) => `L${state.plinkoReturnLevel}`,
  },
  {
    id: 'splitter',
    title: 'Разделитель',
    currentLevel: (state) => state.plinkoSplitterLevel,
    levels: (config) => config.plinko.splitter,
    validate: (state, pending, config) => {
      purchaseSpecialUpgrade(
        state,
        pending,
        config,
        'splitter',
      );
    },
    detail: (state) => `L${state.plinkoSplitterLevel}`,
  },
  {
    id: 'jackpotBias',
    title: 'Уклон к краям',
    currentLevel: (state) => state.plinkoJackpotBiasLevel,
    levels: (config) => config.plinko.jackpotBias,
    validate: (state, pending, config) => {
      purchaseSpecialUpgrade(
        state,
        pending,
        config,
        'jackpotBias',
      );
    },
    detail: (state) => `L${state.plinkoJackpotBiasLevel}`,
  },
  {
    id: 'insurance',
    title: 'Страховка',
    currentLevel: (state) => state.plinkoInsuranceLevel,
    levels: (config) => config.plinko.insurance,
    validate: (state, pending, config) => {
      purchaseInsuranceUpgrade(state, pending, config);
    },
    detail: (state, config) => {
      const level = config.plinko.insurance.find(
        (entry) => entry.level === state.plinkoInsuranceLevel,
      );
      return level
        ? `после ${level.lossesNeeded} проигр. · floor ${Math.round(level.floor * 100)}%`
        : 'не куплено';
    },
  },
];

const describeNextEffect = (id: CasinoUpgradeId, state: GameState, config: BalanceConfig, nextLevel: number): string => {
  if (id === 'maxBet') return `Лимит: ${getMaxBetForLevel(config, state.plinkoMaxBetLevel).toLocaleString('ru-RU')} → ${getMaxBetForLevel(config, nextLevel).toLocaleString('ru-RU')} ₽`;
  if (id === 'center' || id === 'mid' || id === 'jackpot') {
    const levels = getPocketUpgradeLevels(state);
    const next = { ...levels, [`${id}Level`]: nextLevel };
    const before = derivePocketMultipliers(config, levels);
    const after = derivePocketMultipliers(config, next);
    const families = config.plinko.pocketFamilies;
    const main = id === 'jackpot' ? families.edge[0] : id === 'mid' ? families.mid[0] : families.center[0];
    const inner = families.inner[0];
    return `Выплата: ×${before[main]} → ×${after[main]}` + (before[inner] !== after[inner] ? `\nБлижние: ×${before[inner]} → ×${after[inner]}` : '');
  }
  if (id === 'amplifier') {
    const next = config.plinko.amplifier.find(entry => entry.level === nextLevel)!;
    return `Пинов: ${next.count} · сила шара ×${next.multiplier}`;
  }
  if (id === 'return') return `Точек возврата: ${getReturnPins(config, nextLevel).length}\nОтправляют шар наверх`;
  if (id === 'splitter') {
    const next = config.plinko.splitter.find(entry => entry.level === nextLevel)!;
    return `Два шара вместо одного\nСила каждого: ${Math.round(next.childValue * 100)}%`;
  }
  if (id === 'jackpotBias') {
    const next = config.plinko.jackpotBias.find(entry => entry.level === nextLevel)!;
    return `Пар направляющих: ${next.deflectorPairs.length}\nОтклоняют шары к краям`;
  }
  const next = config.plinko.insurance.find(entry => entry.level === nextLevel)!;
  return `После ${next.lossesNeeded} проигрышей:\nследующий бросок вернёт\nот ${Math.round(next.floor * 100)}% ставки`;
};

export const buildCasinoUpgradePreviews = (
  state: GameState,
  pendingDrop: PendingDrop | null,
  config: BalanceConfig,
): CasinoUpgradePreview[] =>
  SPECS.map((spec) => {
    const currentLevel = spec.currentLevel(state);
    const levels = spec.levels(config);
    const maxLevel = levels.at(-1)?.level ?? 0;
    const next = levels.find(
      (entry) => entry.level === currentLevel + 1,
    );
    const maxed = next === undefined;

    return {
      id: spec.id,
      title: spec.title,
      currentLevel,
      maxLevel,
      nextPrice: next?.price ?? null,
      detail: spec.detail(state, config),
      nextEffect: maxed ? 'Максимальный уровень' : describeNextEffect(spec.id, state, config, currentLevel + 1),
      maxed,
      lockedReason: maxed
        ? 'МАКСИМУМ'
        : validate(() => {
            spec.validate(state, pendingDrop, config);
          }),
    };
  });
