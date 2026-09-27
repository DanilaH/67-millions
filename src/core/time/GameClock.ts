const MINUTES_PER_DAY = 24 * 60;

export interface GameClockState {
  dayIndex: number;
  minuteOfDay: number;
}

export const parseClockTime = (value: string): number => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid clock time: ${value}`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error(`Invalid clock time: ${value}`);
  return hour * 60 + minute;
};

export const formatClockTime = (minuteOfDay: number): string => {
  const normalized = ((Math.trunc(minuteOfDay) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const createGameClock = (startTime: string): GameClockState => ({
  dayIndex: 0,
  minuteOfDay: parseClockTime(startTime),
});

export const advanceClock = (clock: GameClockState, minutes: number): GameClockState => {
  if (!Number.isFinite(minutes) || minutes < 0) throw new RangeError('Clock advance must be finite and non-negative');
  const total = clock.minuteOfDay + minutes;
  return {
    dayIndex: clock.dayIndex + Math.floor(total / MINUTES_PER_DAY),
    minuteOfDay: total % MINUTES_PER_DAY,
  };
};

export const minutesUntilBoundary = (clock: GameClockState, boundaryTime: string): number => {
  const boundary = parseClockTime(boundaryTime);
  const delta = (boundary - clock.minuteOfDay + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return delta === 0 ? MINUTES_PER_DAY : delta;
};
