import { describe, expect, it } from 'vitest';

import {
  advanceClock,
  createGameClock,
  formatClockTime,
} from '../src/core/time/GameClock';
import { advanceScheduledTime } from '../src/core/time/scheduler';

describe('authoritative GameClock', () => {
  it('uses 09:00 -> 09:00 as the game-day boundary rather than midnight', () => {
    const start = createGameClock('23:55');
    const afterMidnight = advanceClock(start, 10, '09:00');

    expect(formatClockTime(afterMidnight.minuteOfDay)).toBe('00:05');
    expect(afterMidnight.gameDayIndex).toBe(0);

    const nextMorning = advanceClock(afterMidnight, 9 * 60, '09:00');
    expect(formatClockTime(nextMorning.minuteOfDay)).toBe('09:05');
    expect(nextMorning.gameDayIndex).toBe(1);
  });
});

describe('boundary scheduler', () => {
  it('stops exactly at Barry boundary and preserves remaining action time', () => {
    const clock = createGameClock('08:50');
    const result = advanceScheduledTime(clock, 30, {
      gameDayBoundary: '09:00',
      hardBoundaryTime: '09:00',
    });

    expect(result.hitHardBoundary).toBe(true);
    expect(result.advancedMinutes).toBe(10);
    expect(result.remainingMinutes).toBe(20);
    expect(formatClockTime(result.clock.minuteOfDay)).toBe('09:00');
    expect(result.clock.gameDayIndex).toBe(1);
  });

  it('returns soft checkpoints crossed before a hard interrupt in deterministic order', () => {
    const clock = createGameClock('12:30');
    const result = advanceScheduledTime(clock, 12 * 60, {
      gameDayBoundary: '09:00',
      hardBoundaryTime: '09:00',
      softCheckpointTimes: ['21:00', '13:00', '17:00', '01:00', '05:00'],
    });

    expect(result.hitHardBoundary).toBe(false);
    expect(result.softCheckpointsCrossed).toEqual(['13:00', '17:00', '21:00']);
  });

  it('does not invent a hard boundary when action ends first', () => {
    const clock = createGameClock('08:50');
    const result = advanceScheduledTime(clock, 5, {
      gameDayBoundary: '09:00',
      hardBoundaryTime: '09:00',
    });

    expect(result.hitHardBoundary).toBe(false);
    expect(result.remainingMinutes).toBe(0);
    expect(formatClockTime(result.clock.minuteOfDay)).toBe('08:55');
    expect(result.clock.gameDayIndex).toBe(0);
  });
});
