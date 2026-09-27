import { describe, expect, it } from 'vitest';

import {
  consumeActiveActionTime,
  createActiveAction,
} from '../src/core/actions/ActiveAction';

describe('ActiveAction', () => {
  it('tracks remaining time without changing reservation state', () => {
    const action = createActiveAction({
      kind: 'TIMED_PAID',
      actionId: 'FOOD_01',
      remainingMinutes: 45,
      upfrontApplied: true,
      startedAtGameDayIndex: 0,
      startedAtMinuteOfDay: 600,
    });

    expect(consumeActiveActionTime(action, 20)).toEqual({
      ...action,
      remainingMinutes: 25,
    });
    expect(consumeActiveActionTime(action, 45)).toBeNull();
  });
});
