import type { BalanceConfig } from '../../config/balance.schema';
import { createActiveAction, type WorkActiveAction } from '../actions/ActiveAction';
import { creditCash, debitCash, roundMoney } from '../economy/money';
import type { GameState } from '../state/GameState';
import type { ActiveAction } from '../actions/ActiveAction';
import type { PendingDrop } from '../plinko-rules/drop';
import { applyNeedsDelta } from '../state/mutations';
import { parseClockTime } from '../time/GameClock';

export type JobId = keyof BalanceConfig['work']['jobs'];

const isInWindow = (minuteOfDay: number, window: string): boolean => {
  if (window === '24/7') return true;
  const [startRaw, endRaw] = window.split('-');
  if (!startRaw || !endRaw) throw new Error(`Invalid work window: ${window}`);
  const start = parseClockTime(startRaw);
  const end = parseClockTime(endRaw);
  return start < end
    ? minuteOfDay >= start && minuteOfDay < end
    : minuteOfDay >= start || minuteOfDay < end;
};

export const getWorkLevel = (config: BalanceConfig, jobId: JobId, level: number) => {
  const value = config.work.jobs[jobId].levels.find((entry) => entry.level === level);
  if (!value) throw new Error(`Unknown ${jobId} level ${level}`);
  return value;
};

export const getOwnedWorkLevel = (
  state: GameState,
  jobId: JobId,
): number => state.workLevels[jobId];

export const purchaseWorkUpgrade = (
  state: GameState,
  config: BalanceConfig,
  jobId: JobId,
  activeAction: ActiveAction | null,
  pendingDrop: PendingDrop | null,
): GameState => {
  if (state.terminalReason !== null || state.victory || state.barryInterruptPending) {
    throw new Error('Cannot buy work upgrades in the current run state');
  }
  if (activeAction !== null) {
    throw new Error('Cannot buy work upgrades while an action is active');
  }
  if (pendingDrop !== null) {
    throw new Error('Cannot buy work upgrades while a Drop is pending');
  }

  const currentLevel = getOwnedWorkLevel(state, jobId);
  const next = config.work.jobs[jobId].levels.find(
    (entry) => entry.level === currentLevel + 1,
  );
  if (!next) {
    throw new Error(`${jobId} work track is already maxed`);
  }

  return {
    ...state,
    cash: debitCash(state.cash, next.upgradePrice),
    workLevels: {
      ...state.workLevels,
      [jobId]: next.level,
    },
  };
};

export const startWork = (
  state: GameState,
  config: BalanceConfig,
  jobId: JobId,
): { state: GameState; action: WorkActiveAction } => {
  if (state.terminalReason !== null || state.victory || state.barryInterruptPending) {
    throw new Error('Cannot start work in the current run state');
  }

  const level = getOwnedWorkLevel(state, jobId);
  const definition = getWorkLevel(config, jobId, level);
  if (!isInWindow(state.clock.minuteOfDay, definition.window)) {
    throw new Error('Job is outside its start window');
  }
  if (state.needs.energy < definition.energyCost) {
    throw new Error('Not enough Energy to start work');
  }

  const charged = applyNeedsDelta(
    state,
    {
      energy: -definition.energyCost,
      happiness: -definition.happinessCost,
    },
    { min: config.needs.min, max: config.needs.max },
  ).state;

  const action = createActiveAction({
    kind: 'WORK',
    actionId: jobId,
    level,
    payoutMultiplierAtStart: state.workPayoutMultiplier,
    result: null,
    remainingMinutes: definition.durationMinutes,
    upfrontApplied: true,
    startedAtGameDayIndex: state.clock.gameDayIndex,
    startedAtMinuteOfDay: state.clock.minuteOfDay,
  }) as WorkActiveAction;

  return { state: charged, action };
};

export const setWorkResult = (
  action: WorkActiveAction,
  result: 'SUCCESS' | 'FAILURE',
): WorkActiveAction => ({ ...action, result });

export const settleWork = (
  state: GameState,
  action: WorkActiveAction,
  config: BalanceConfig,
): GameState => {
  if (state.terminalReason !== null) return state;
  if (action.result === null) throw new Error('Work result must be known before settlement');

  const definition = getWorkLevel(config, action.actionId as JobId, action.level);
  const potentialPayout = roundMoney(
    definition.payout * action.payoutMultiplierAtStart,
  );

  if (action.result === 'SUCCESS') {
    return { ...state, cash: creditCash(state.cash, potentialPayout) };
  }

  const fine = Math.min(
    state.cash,
    roundMoney(potentialPayout * config.work.failure.fineAsPotentialPayout),
  );
  const afterFine = { ...state, cash: debitCash(state.cash, fine) };
  return applyNeedsDelta(
    afterFine,
    { happiness: config.work.failure.extraHappiness },
    { min: config.needs.min, max: config.needs.max },
  ).state;
};
