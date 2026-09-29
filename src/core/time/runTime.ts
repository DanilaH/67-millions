import type { BalanceConfig } from '../../config/balance.schema';
import {
  consumeActiveActionTime,
  type ActiveAction,
} from '../actions/ActiveAction';
import { beginBarryInterrupt } from '../barry/barry';
import { resetDumpsterSearchStreak } from '../actions/dumpster';
import { advanceNeeds } from '../needs/needs';
import { finalizeSleepCycle } from '../sleep/sleep';
import type { GameState } from '../state/GameState';
import { advanceClock } from './GameClock';
import { advanceScheduledTime } from './scheduler';

export interface RunTimeAdvanceResult {
  state: GameState;
  activeAction: ActiveAction | null;
  actionCompleted: boolean;
  advancedMinutes: number;
  softCheckpointsCrossed: string[];
}

export const advanceRunTime = (
  state: GameState,
  activeAction: ActiveAction | null,
  requestedMinutes: number,
  config: BalanceConfig,
): RunTimeAdvanceResult => {
  if (state.barryInterruptPending) {
    throw new Error('Cannot advance time while Barry interrupt is pending');
  }

  if (
    activeAction !== null &&
    activeAction.remainingMinutes === 0 &&
    state.terminalReason === null &&
    !state.victory
  ) {
    return {
      state,
      activeAction: null,
      actionCompleted: true,
      advancedMinutes: 0,
      softCheckpointsCrossed: [],
    };
  }

  if (state.terminalReason !== null || state.victory || requestedMinutes <= 0) {
    return {
      state,
      activeAction,
      actionCompleted: false,
      advancedMinutes: 0,
      softCheckpointsCrossed: [],
    };
  }

  const scheduled = advanceScheduledTime(state.clock, requestedMinutes, {
    gameDayBoundary: config.time.gameDayBoundary,
    hardBoundaryTime: config.barry.time,
    softCheckpointTimes: config.time.eventCheckpoints,
  });

  const mode = activeAction?.kind === 'SLEEP' ? 'SLEEP' : 'AWAKE';
  const needs = advanceNeeds(state, scheduled.advancedMinutes, mode, config);
  const actualMinutes = needs.consumedMinutes;

  let nextState: GameState = {
    ...needs.state,
    clock: advanceClock(state.clock, actualMinutes, config.time.gameDayBoundary),
  };
  let nextAction = activeAction
    ? consumeActiveActionTime(activeAction, actualMinutes)
    : null;
  let actionCompleted = activeAction !== null && nextAction === null;

  if (
    activeAction?.kind === 'SLEEP' &&
    actionCompleted &&
    config.dumpster.resetStreakAfterSleep
  ) {
    nextState = resetDumpsterSearchStreak(nextState);
  }

  const actualSchedule = advanceScheduledTime(state.clock, actualMinutes, {
    gameDayBoundary: config.time.gameDayBoundary,
    hardBoundaryTime: config.barry.time,
    softCheckpointTimes: config.time.eventCheckpoints,
  });

  if (nextState.terminalReason !== null) {
    return {
      state: nextState,
      activeAction: nextAction,
      actionCompleted,
      advancedMinutes: actualMinutes,
      softCheckpointsCrossed: actualSchedule.softCheckpointsCrossed,
    };
  }

  if (scheduled.hitHardBoundary && actualMinutes === scheduled.advancedMinutes) {
    if (config.dumpster.resetStreakAtGameDayBoundary) {
      nextState = resetDumpsterSearchStreak(nextState);
    }
    nextState = finalizeSleepCycle(nextState, config);

    if (activeAction?.kind === 'SLEEP') {
      nextAction = null;
      actionCompleted = true;
    } else if (activeAction !== null && nextAction === null) {
      nextAction = { ...activeAction, remainingMinutes: 0 };
      actionCompleted = false;
    }

    nextState = beginBarryInterrupt(nextState);
  }

  return {
    state: nextState,
    activeAction: nextAction,
    actionCompleted,
    advancedMinutes: actualMinutes,
    softCheckpointsCrossed: actualSchedule.softCheckpointsCrossed,
  };
};
