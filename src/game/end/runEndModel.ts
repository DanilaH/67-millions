import type { BalanceConfig } from '../../config/balance.schema';
import { canPayMainDebt } from '../../core/economy/mainDebt';
import type { GameState } from '../../core/state/GameState';
import { formatClockTime } from '../../core/time/GameClock';
import { BARRY_CONTENT } from '../content/contentCatalog';

export type RunEndKind = 'VICTORY' | 'GAME_OVER';

export interface RunEndStat {
  label: string;
  value: string;
}

export interface RunEndSummary {
  kind: RunEndKind;
  title: string;
  reason: string;
  stats: RunEndStat[];
}

export interface PrincipalConfirmation {
  amount: number;
  cashBefore: number;
  cashAfter: number;
  title: string;
  warning: string;
}

const formatMoney = (value: number): string =>
  `${value.toLocaleString('ru-RU')} ₽`;

const formatNeeds = (state: GameState): string =>
  [
    `HP ${Math.round(state.needs.health)}`,
    `Сыт. ${Math.round(state.needs.satiety)}`,
    `Эн. ${Math.round(state.needs.energy)}`,
    `Сч. ${Math.round(state.needs.happiness)}`,
  ].join(' · ');

const formatPlinkoProgress = (state: GameState): string => {
  const levels = [
    state.plinkoCapacityLevel,
    state.plinkoMaxBetLevel,
    state.plinkoCenterLevel,
    state.plinkoMidLevel,
    state.plinkoJackpotLevel,
    state.plinkoAmplifierLevel,
    state.plinkoReturnLevel,
    state.plinkoSplitterLevel,
    state.plinkoJackpotBiasLevel,
    state.plinkoInsuranceLevel,
  ];
  const total = levels.reduce((sum, level) => sum + level, 0);
  return `${total} уровней · max bet L${state.plinkoMaxBetLevel}`;
};

const gameOverReason = (state: GameState): string => {
  if (state.terminalReason === 'BARRY_PAYMENT_FAILED') {
    return BARRY_CONTENT.failed;
  }
  if (state.terminalReason === 'HEALTH_ZERO') {
    return 'HP опустился до нуля.';
  }
  throw new Error('Game Over summary requires a terminal reason');
};

export const deriveRunEndSummary = (
  state: GameState,
  config: BalanceConfig,
): RunEndSummary => {
  if (!state.victory && state.terminalReason === null) {
    throw new Error('Run end summary requires Victory or Game Over');
  }

  const kind: RunEndKind = state.victory
    ? 'VICTORY'
    : 'GAME_OVER';
  const principalPaid =
    config.game.mainDebt - state.mainDebt;

  return {
    kind,
    title:
      kind === 'VICTORY'
        ? '67 МИЛЛИОНОВ ПОГАШЕНЫ'
        : 'ЗАБЕГ ОКОНЧЕН',
    reason:
      kind === 'VICTORY'
        ? 'Основной долг выплачен вручную. Ты выбрался.'
        : gameOverReason(state),
    stats: [
      {
        label: 'Финиш',
        value: `День ${state.clock.gameDayIndex + 1} · ${formatClockTime(state.clock.minuteOfDay)}`,
      },
      {
        label: 'Деньги',
        value: formatMoney(state.cash),
      },
      {
        label: 'Барри выплачено',
        value: formatMoney(state.totalBarryPaid),
      },
      {
        label: 'Платежей Барри',
        value: String(state.barryPaymentIndex),
      },
      {
        label: 'Основной долг погашен',
        value: formatMoney(principalPaid),
      },
      {
        label: 'Потребности',
        value: formatNeeds(state),
      },
      {
        label: 'Работы',
        value: `Посуда L${state.jobLevels.dishes} · Мусор L${state.jobLevels.trash} · Курьер L${state.jobLevels.courier}`,
      },
      {
        label: 'Plinko',
        value: formatPlinkoProgress(state),
      },
    ],
  };
};

export const derivePrincipalConfirmation = (
  state: GameState,
  config: BalanceConfig,
): PrincipalConfirmation => {
  if (!canPayMainDebt(state)) {
    throw new Error(
      'Principal confirmation requires enough cash and a payable run state',
    );
  }

  return {
    amount: state.mainDebt,
    cashBefore: state.cash,
    cashAfter: state.cash - state.mainDebt,
    title: 'ПОГАСИТЬ 67 МИЛЛИОНОВ?',
    warning:
      'Это ручное финальное действие. После подтверждения текущий забег завершится победой.',
  };
};
