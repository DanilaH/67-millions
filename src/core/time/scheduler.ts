import {
  advanceClock,
  minutesUntilClockTime,
  type GameClockState,
} from './GameClock';

export interface ScheduledAdvance {
  clock: GameClockState;
  advancedMinutes: number;
  remainingMinutes: number;
  hitHardBoundary: boolean;
  softCheckpointsCrossed: string[];
}

const isCheckpointWithinAdvance = (
  clock: GameClockState,
  checkpoint: string,
  advancedMinutes: number,
): boolean =>
  minutesUntilClockTime(clock, checkpoint) <= advancedMinutes;

export const advanceScheduledTime = (
  clock: GameClockState,
  durationMinutes: number,
  options: {
    gameDayBoundary: string;
    hardBoundaryTime: string;
    softCheckpointTimes?: readonly string[];
  },
): ScheduledAdvance => {
  if (!Number.isFinite(durationMinutes) || durationMinutes < 0) {
    throw new RangeError('durationMinutes must be finite and non-negative');
  }

  const toHardBoundary = minutesUntilClockTime(clock, options.hardBoundaryTime);
  const advancedMinutes = Math.min(durationMinutes, toHardBoundary);
  const hitHardBoundary = durationMinutes >= toHardBoundary;

  const softCheckpointsCrossed = (options.softCheckpointTimes ?? [])
    .filter((checkpoint) => isCheckpointWithinAdvance(clock, checkpoint, advancedMinutes))
    .sort(
      (left, right) =>
        minutesUntilClockTime(clock, left) - minutesUntilClockTime(clock, right),
    );

  return {
    clock: advanceClock(clock, advancedMinutes, options.gameDayBoundary),
    advancedMinutes,
    remainingMinutes: durationMinutes - advancedMinutes,
    hitHardBoundary,
    softCheckpointsCrossed,
  };
};
