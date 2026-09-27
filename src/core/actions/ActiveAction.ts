export type ActiveActionKind = 'TIMED_PAID' | 'WORK' | 'DUMPSTER' | 'SLEEP';

export interface ActiveAction {
  kind: ActiveActionKind;
  actionId: string;
  remainingMinutes: number;
  upfrontApplied: boolean;
  startedAtGameDayIndex: number;
  startedAtMinuteOfDay: number;
}

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
