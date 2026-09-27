import type { BalanceConfig } from '../../config/balance.schema';
import { createActiveAction, type TimedPaidActiveAction } from './ActiveAction';
import { debitCash } from '../economy/money';
import type { NeedsDelta } from '../state/mutations';
import { applyNeedsDelta } from '../state/mutations';
import type { GameState } from '../state/GameState';

export interface TimedPaidActionDefinition {
  id: string;
  price: number;
  durationMinutes: number;
  completionNeedsDelta?: NeedsDelta;
}

export interface StartedTimedPaidAction {
  state: GameState;
  action: TimedPaidActiveAction;
}

export const startTimedPaidAction = (
  state: GameState,
  definition: TimedPaidActionDefinition,
): StartedTimedPaidAction => {
  if (state.terminalReason !== null || state.victory) {
    throw new Error('Cannot start action after run end');
  }

  const cash = debitCash(state.cash, definition.price);
  const action = createActiveAction({
    kind: 'TIMED_PAID',
    actionId: definition.id,
    remainingMinutes: definition.durationMinutes,
    upfrontApplied: true,
    startedAtGameDayIndex: state.clock.gameDayIndex,
    startedAtMinuteOfDay: state.clock.minuteOfDay,
  }) as TimedPaidActiveAction;

  return { state: { ...state, cash }, action };
};

export const applyTimedPaidCompletion = (
  state: GameState,
  definition: TimedPaidActionDefinition,
  config: BalanceConfig,
): GameState => {
  if (state.terminalReason !== null || !definition.completionNeedsDelta) return state;

  return applyNeedsDelta(state, definition.completionNeedsDelta, {
    min: config.needs.min,
    max: config.needs.max,
  }).state;
};
