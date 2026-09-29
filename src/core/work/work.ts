import type { BalanceConfig } from '../../config/balance.schema';
import {
  createActiveAction,
  type ActiveAction,
  type WorkActiveAction,
} from '../actions/ActiveAction';
import { creditCash, debitCash, roundMoney } from '../economy/money';
import type { PendingDrop } from '../plinko-rules/drop';
import type { GameState } from '../state/GameState';
import { applyNeedsDelta } from '../state/mutations';
import { hasStatus } from '../state/statuses';
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

const getLevel = (config: BalanceConfig, jobId: JobId, level: number) => {
  const value = config.work.jobs[jobId].levels.find((entry) => entry.level === level);
  if (!value) throw new Error(`Unknown ${jobId} level ${level}`);
  return value;
};

const assertJobUpgradePurchasable = (
  state: GameState,
  activeAction: ActiveAction | null,
  pendingDrop: PendingDrop | null,
): void => {
  if (pendingDrop !== null) {
    throw new Error('Cannot buy job upgrades while a Drop is pending');
  }
  if (activeAction !== null) {
    throw new Error('Cannot buy job upgrades while an action is active');
  }
  if (state.barryInterruptPending) {
    throw new Error('Cannot buy job upgrades while Barry is pending');
  }
  if (state.terminalReason !== null || state.victory) {
    throw new Error('Cannot buy job upgrades after the run has ended');
  }
};

export const purchaseJobUpgrade = (
  state: GameState,
  activeAction: ActiveAction | null,
  pendingDrop: PendingDrop | null,
  config: BalanceConfig,
  jobId: JobId,
): GameState => {
  assertJobUpgradePurchasable(state, activeAction, pendingDrop);

  const currentLevel = state.jobLevels[jobId];
  const next = config.work.jobs[jobId].levels.find(
    (entry) => entry.level === currentLevel + 1,
  );
  if (!next) throw new Error(`${jobId} job is already maxed`);

  return {
    ...state,
    cash: debitCash(state.cash, next.upgradePrice),
    jobLevels: {
      ...state.jobLevels,
      [jobId]: next.level,
    },
  };
};

export const startWork = (
  state: GameState,
  config: BalanceConfig,
  jobId: JobId,
  level: number,
): { state: GameState; action: WorkActiveAction } => {
  if (state.terminalReason !== null || state.victory || state.barryInterruptPending) {
    throw new Error('Cannot start work in the current run state');
  }

  const definition = getLevel(config, jobId, level);
  if (
    hasStatus(state, 'SMELLY') &&
    config.statuses.SMELLY.blocksJobs.includes(jobId)
  ) {
    throw new Error(`${jobId} job is blocked by SMELLY`);
  }
  if (level > state.jobLevels[jobId]) {
    throw new Error('Job level is not owned');
  }
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

  const definition = getLevel(config, action.actionId as JobId, action.level);
  const potentialPayout = roundMoney(definition.payout * state.workPayoutMultiplier);

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
