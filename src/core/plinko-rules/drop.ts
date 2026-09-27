import type { BalanceConfig } from '../../config/balance.schema';
import { creditCash, debitCash, roundMoney } from '../economy/money';
import type { GameState } from '../state/GameState';
import { applyNeedsDelta } from '../state/mutations';

export type BetFraction = 0.25 | 0.5 | 1;

export interface PendingDrop {
  dropId: string;
  originalStake: number;
  selectedFraction: BetFraction;
  maxBetLevel: number;
  committedGameDayIndex: number;
  committedMinuteOfDay: number;
  remainingActionMinutes: number;
}

export interface DropSettlement {
  state: GameState;
  payout: number;
  multiplier: number;
  losing: boolean;
}

const getMaxBetEntry = (
  config: BalanceConfig,
  level: number,
) => {
  const entry = config.plinko.maxBetLevels.find((item) => item.level === level);
  if (!entry) throw new Error(`Unknown max-bet level ${level}`);
  return entry;
};

export const calculateActualBet = (
  cash: number,
  maxBet: number,
  fraction: BetFraction,
): number => {
  if (cash <= 0) throw new Error('Cannot Drop with zero cash');
  const requested = roundMoney(maxBet * fraction);
  return Math.min(roundMoney(cash), requested);
};

export const commitBareDrop = (
  state: GameState,
  config: BalanceConfig,
  dropId: string,
  selectedFraction: BetFraction = state.plinkoSelectedBetFraction,
): { state: GameState; pendingDrop: PendingDrop } => {
  if (!dropId) throw new Error('Drop requires a stable dropId');
  if (state.terminalReason !== null || state.victory || state.barryInterruptPending) {
    throw new Error('Cannot commit Drop in the current run state');
  }

  const maxBet = getMaxBetEntry(config, state.plinkoMaxBetLevel).maxBet;
  const originalStake = calculateActualBet(state.cash, maxBet, selectedFraction);

  return {
    state: {
      ...state,
      cash: debitCash(state.cash, originalStake),
      plinkoSelectedBetFraction: selectedFraction,
    },
    pendingDrop: {
      dropId,
      originalStake,
      selectedFraction,
      maxBetLevel: state.plinkoMaxBetLevel,
      committedGameDayIndex: state.clock.gameDayIndex,
      committedMinuteOfDay: state.clock.minuteOfDay,
      remainingActionMinutes: config.time.plinkoDropTimeMinutes,
    },
  };
};

export const settleBareDrop = (
  state: GameState,
  pendingDrop: PendingDrop,
  pocketIndex: number,
  config: BalanceConfig,
): DropSettlement => {
  const multiplier = config.plinko.basePockets[pocketIndex];
  if (multiplier === undefined) throw new RangeError('Invalid Plinko pocket index');

  const payout = roundMoney(pendingDrop.originalStake * multiplier);
  const losing = payout < pendingDrop.originalStake;

  let nextState: GameState = {
    ...state,
    cash: creditCash(state.cash, payout),
  };

  if (losing) {
    nextState = applyNeedsDelta(
      nextState,
      { happiness: config.needs.plinkoLosingDropHappiness },
      { min: config.needs.min, max: config.needs.max },
    ).state;
  }

  return { state: nextState, payout, multiplier, losing };
};
