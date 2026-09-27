interface ActiveActionBase {
  actionId: string;
  remainingMinutes: number;
  startedAtGameDayIndex: number;
  startedAtMinuteOfDay: number;
}

export interface TimedPaidActiveAction extends ActiveActionBase {
  kind: 'TIMED_PAID';
  upfrontApplied: true;
}

export interface WorkActiveAction extends ActiveActionBase {
  kind: 'WORK';
  upfrontApplied: true;
  level: number;
  result: 'SUCCESS' | 'FAILURE' | null;
}

export interface DumpsterActiveAction extends ActiveActionBase {
  kind: 'DUMPSTER';
  upfrontApplied: true;
}

export interface SleepActiveAction extends ActiveActionBase {
  kind: 'SLEEP';
  upfrontApplied: false;
}

export type ActiveAction =
  | TimedPaidActiveAction
  | WorkActiveAction
  | DumpsterActiveAction
  | SleepActiveAction;

export const createActiveAction = (input: ActiveAction): ActiveAction => {
  if (!input.actionId) throw new Error('Active action requires actionId');
  if (!Number.isFinite(input.remainingMinutes) || input.remainingMinutes < 0) {
    throw new RangeError('Active action remainingMinutes must be finite and non-negative');
  }
  if (!Number.isInteger(input.startedAtGameDayIndex) || input.startedAtGameDayIndex < 0) {
    throw new RangeError('startedAtGameDayIndex must be a non-negative integer');
  }
  if (
    !Number.isFinite(input.startedAtMinuteOfDay) ||
    input.startedAtMinuteOfDay < 0 ||
    input.startedAtMinuteOfDay >= 24 * 60
  ) {
    throw new RangeError('startedAtMinuteOfDay must be within one day');
  }
  if (input.kind === 'WORK' && (!Number.isInteger(input.level) || input.level <= 0)) {
    throw new RangeError('Work action level must be a positive integer');
  }
  return { ...input };
};

export const consumeActiveActionTime = (
  action: ActiveAction,
  advancedMinutes: number,
): ActiveAction | null => {
  if (!Number.isFinite(advancedMinutes) || advancedMinutes < 0) {
    throw new RangeError('advancedMinutes must be finite and non-negative');
  }
  const remainingMinutes = Math.max(0, action.remainingMinutes - advancedMinutes);
  return remainingMinutes === 0 ? null : { ...action, remainingMinutes };
};
