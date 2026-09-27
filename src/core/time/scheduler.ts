import {
  advanceClock,
  minutesUntilBoundary,
  type GameClockState,
} from './GameClock';

export interface BoundaryAdvance {
  clock: GameClockState;
  advancedMinutes: number;
  remainingMinutes: number;
  hitBoundary: boolean;
}

export const advanceUntilBoundary = (
  clock: GameClockState,
  durationMinutes: number,
  boundaryTime: string,
): BoundaryAdvance => {
  if (!Number.isFinite(durationMinutes) || durationMinutes < 0) {
    throw new RangeError('durationMinutes must be finite and non-negative');
  }

  const toBoundary = minutesUntilBoundary(clock, boundaryTime);
  const advancedMinutes = Math.min(durationMinutes, toBoundary);

  return {
    clock: advanceClock(clock, advancedMinutes),
    advancedMinutes,
    remainingMinutes: durationMinutes - advancedMinutes,
    hitBoundary: durationMinutes >= toBoundary,
  };
};
