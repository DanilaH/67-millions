import type { BalanceConfig } from '../../config/balance.schema';
import type { ActiveAction, TimedPaidActiveAction } from './ActiveAction';
import {
  startTimedPaidAction,
  type StartedTimedPaidAction,
} from './timedPaidAction';
import type { PendingDrop } from '../plinko-rules/drop';
import type { GameState } from '../state/GameState';
import { removeStatus } from '../state/statuses';

const SHOWER_ACTION_ID = 'SHOWER';

const assertCanStartShower = (
  activeAction: ActiveAction | null,
  pendingDrop: PendingDrop | null,
): void => {
  if (pendingDrop !== null) {
    throw new Error('Cannot shower while a Drop is pending');
  }
  if (activeAction !== null) {
    throw new Error('Cannot shower while another action is active');
  }
};

export const startShower = (
  state: GameState,
  activeAction: ActiveAction | null,
  pendingDrop: PendingDrop | null,
  config: BalanceConfig,
): StartedTimedPaidAction => {
  assertCanStartShower(activeAction, pendingDrop);

  return startTimedPaidAction(state, {
    id: SHOWER_ACTION_ID,
    price: config.shower.price,
    durationMinutes: config.shower.durationMinutes,
  });
};

export const settleShower = (
  state: GameState,
  action: TimedPaidActiveAction,
  config: BalanceConfig,
): GameState => {
  if (action.actionId !== SHOWER_ACTION_ID) {
    throw new Error('Expected SHOWER timed action');
  }
  if (state.terminalReason !== null || state.victory) return state;

  return config.shower.removes.reduce(
    (nextState, statusId) => removeStatus(nextState, statusId),
    state,
  );
};
