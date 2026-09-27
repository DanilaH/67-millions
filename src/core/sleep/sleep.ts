import type { BalanceConfig } from '../../config/balance.schema';
import { createActiveAction, type SleepActiveAction } from '../actions/ActiveAction';
import type { GameState } from '../state/GameState';

export const startSleep = (
  state: GameState,
  config: BalanceConfig,
): SleepActiveAction => {
  if (state.terminalReason !== null || state.victory || state.barryInterruptPending) {
    throw new Error('Cannot sleep in the current run state');
  }

  return createActiveAction({
    kind: 'SLEEP',
    actionId: 'SLEEP',
    remainingMinutes: config.sleep.fullSleepHours * 60,
    upfrontApplied: false,
    startedAtGameDayIndex: state.clock.gameDayIndex,
    startedAtMinuteOfDay: state.clock.minuteOfDay,
  }) as SleepActiveAction;
};

export const finalizeSleepCycle = (
  state: GameState,
  config: BalanceConfig,
): GameState => {
  const sleptHours = state.sleepMinutesCurrentGameDay / 60;
  const missingHours = Math.max(0, config.sleep.fullSleepHours - sleptHours);
  const workPayoutMultiplier = Math.max(
    config.sleep.workPayoutFloorMultiplier,
    1 - missingHours * config.sleep.workPenaltyPerMissingHour,
  );

  return {
    ...state,
    sleepMinutesCurrentGameDay: 0,
    workPayoutMultiplier,
  };
};
