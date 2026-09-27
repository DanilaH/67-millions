import type { BalanceConfig } from '../../config/balance.schema';
import {
  consumeActiveActionTime,
  type ActiveAction,
} from '../actions/ActiveAction';
import { beginBarryInterrupt } from '../barry/barry';
import { advanceNeeds } from '../needs/needs';
import { finalizeSleepCycle } from '../sleep/sleep';
import type { GameState } from '../state/GameState';
import { advanceClock } from './GameClock';
import { advanceScheduledTime } from './scheduler';

export interface RunTimeAdvanceResult {
  state: GameState;
  activeAction: ActiveAction | null;
  actionCompleted: boolean;
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
  if (state.terminalReason !== null || state.victory || requestedMinutes <= 0) {
    return {
      state,
      activeAction,
      actionCompleted: false,
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
  const actionCompleted = activeAction !== null && nextAction === null;

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
      softCheckpointsCrossed: actualSchedule.softCheckpointsCrossed,
    };
  }

  if (scheduled.hitHardBoundary && actualMinutes === scheduled.advancedMinutes) {
    nextState = finalizeSleepCycle(nextState, config);
    if (activeAction?.kind === 'SLEEP') {
      nextAction = null;
    }
    nextState = beginBarryInterrupt(nextState);
  }

  return {
    state: nextState,
    activeAction: nextAction,
    actionCompleted:
      actionCompleted || (activeAction?.kind === 'SLEEP' && nextAction === null),
    softCheckpointsCrossed: actualSchedule.softCheckpointsCrossed,
  };
};
