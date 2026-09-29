import type { BalanceConfig } from '../../config/balance.schema';
import type { GameState } from '../state/GameState';
import { advanceRunTime } from '../time/runTime';
import {
  setWorkResult,
  settleWork,
} from './work';
import type { WorkActiveAction } from '../actions/ActiveAction';

export interface WorkSkillCompletion {
  state: GameState;
  activeAction: WorkActiveAction | null;
  shiftCompleted: boolean;
  advancedMinutes: number;
}

export const completeWorkSkill = (
  state: GameState,
  action: WorkActiveAction,
  result: 'SUCCESS' | 'FAILURE',
  config: BalanceConfig,
): WorkSkillCompletion => {
  if (action.result !== null) {
    throw new Error('Work skill result is already resolved');
  }

  const resolvedAction = setWorkResult(action, result);
  const advanced = advanceRunTime(
    state,
    resolvedAction,
    resolvedAction.remainingMinutes,
    config,
  );

  if (
    advanced.actionCompleted &&
    advanced.state.terminalReason === null
  ) {
    return {
      state: settleWork(
        advanced.state,
        resolvedAction,
        config,
      ),
      activeAction: null,
      shiftCompleted: true,
      advancedMinutes: advanced.advancedMinutes,
    };
  }

  return {
    state: advanced.state,
    activeAction:
      advanced.activeAction as WorkActiveAction | null,
    shiftCompleted: false,
    advancedMinutes: advanced.advancedMinutes,
  };
};
