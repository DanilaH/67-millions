import type { BalanceConfig } from '../../config/balance.schema';
import { resolveBarryPayment } from '../barry/barry';
import type { GameState } from '../state/GameState';
import { advanceRunTime } from '../time/runTime';
import {
  calculateBallPocketPayout,
  settleAggregateDrop,
  type DropSettlement,
  type PendingDrop,
} from './drop';

export interface DropTimeAdvanceResult {
  state: GameState;
  pendingDrop: PendingDrop;
  advancedMinutes: number;
  softCheckpointsCrossed: string[];
}

export interface TimedDropSettlement extends DropSettlement {
  pendingDrop: null;
  remainingMinutesAdvancedAfterBarry: number;
  softCheckpointsCrossedAfterBarry: string[];
}

export const advancePendingDropTime = (
  state: GameState,
  pendingDrop: PendingDrop,
  config: BalanceConfig,
): DropTimeAdvanceResult => {
  if (pendingDrop.remainingActionMinutes <= 0) {
    return {
      state,
      pendingDrop,
      advancedMinutes: 0,
      softCheckpointsCrossed: [],
    };
  }

  if (state.barryInterruptPending) {
    return {
      state,
      pendingDrop,
      advancedMinutes: 0,
      softCheckpointsCrossed: [],
    };
  }

  const advanced = advanceRunTime(
    state,
    null,
    pendingDrop.remainingActionMinutes,
    config,
  );

  return {
    state: advanced.state,
    pendingDrop: {
      ...pendingDrop,
      remainingActionMinutes: Math.max(
        0,
        pendingDrop.remainingActionMinutes - advanced.advancedMinutes,
      ),
    },
    advancedMinutes: advanced.advancedMinutes,
    softCheckpointsCrossed: advanced.softCheckpointsCrossed,
  };
};

export const settleAggregatePendingDropAndResumeTime = (
  state: GameState,
  pendingDrop: PendingDrop,
  aggregatePayout: number,
  config: BalanceConfig,
): TimedDropSettlement => {
  const settled = settleAggregateDrop(
    state,
    pendingDrop,
    aggregatePayout,
    config,
  );

  let nextState = settled.state;

  if (nextState.barryInterruptPending) {
    nextState = resolveBarryPayment(nextState, config);
  }

  if (nextState.terminalReason !== null || nextState.victory) {
    return {
      ...settled,
      state: nextState,
      pendingDrop: null,
      remainingMinutesAdvancedAfterBarry: 0,
      softCheckpointsCrossedAfterBarry: [],
    };
  }

  const resumed = advancePendingDropTime(nextState, pendingDrop, config);

  return {
    ...settled,
    state: resumed.state,
    pendingDrop: null,
    remainingMinutesAdvancedAfterBarry: resumed.advancedMinutes,
    softCheckpointsCrossedAfterBarry: resumed.softCheckpointsCrossed,
  };
};

export const settlePendingDropAndResumeTime = (
  state: GameState,
  pendingDrop: PendingDrop,
  pocketIndex: number,
  config: BalanceConfig,
): TimedDropSettlement =>
  settleAggregatePendingDropAndResumeTime(
    state,
    pendingDrop,
    calculateBallPocketPayout(pendingDrop, 1, pocketIndex, config),
    config,
  );
