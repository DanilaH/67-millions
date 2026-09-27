import { describe, expect, it } from 'vitest';

import { createGameClock, formatClockTime } from '../src/core/time/GameClock';
import { advanceUntilBoundary } from '../src/core/time/scheduler';

describe('boundary scheduler primitive', () => {
  it('stops exactly at Barry boundary and preserves remaining action time', () => {
    const clock = createGameClock('08:50');
    const result = advanceUntilBoundary(clock, 30, '09:00');

    expect(result.hitBoundary).toBe(true);
    expect(result.advancedMinutes).toBe(10);
    expect(result.remainingMinutes).toBe(20);
    expect(formatClockTime(result.clock.minuteOfDay)).toBe('09:00');
  });

  it('does not invent a boundary when action ends first', () => {
    const clock = createGameClock('08:50');
    const result = advanceUntilBoundary(clock, 5, '09:00');

    expect(result.hitBoundary).toBe(false);
    expect(result.remainingMinutes).toBe(0);
    expect(formatClockTime(result.clock.minuteOfDay)).toBe('08:55');
  });
});
