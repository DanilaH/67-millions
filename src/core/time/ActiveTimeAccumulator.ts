export interface ActiveTimeAccumulatorState {
  carriedRealSeconds: number;
}

export class ActiveTimeAccumulator {
  private carriedRealSeconds: number;

  public constructor(
    private readonly realSecondsPerGameMinute: number,
    state: ActiveTimeAccumulatorState = { carriedRealSeconds: 0 },
  ) {
    if (!Number.isFinite(realSecondsPerGameMinute) || realSecondsPerGameMinute <= 0) {
      throw new RangeError('realSecondsPerGameMinute must be positive and finite');
    }
    if (!Number.isFinite(state.carriedRealSeconds) || state.carriedRealSeconds < 0) {
      throw new RangeError('carriedRealSeconds must be finite and non-negative');
    }
    this.carriedRealSeconds = state.carriedRealSeconds;
  }

  public consume(deltaRealSeconds: number, active: boolean): number {
    if (!Number.isFinite(deltaRealSeconds) || deltaRealSeconds < 0) {
      throw new RangeError('deltaRealSeconds must be finite and non-negative');
    }
    if (!active || deltaRealSeconds === 0) return 0;

    this.carriedRealSeconds += deltaRealSeconds;
    const gameMinutes = Math.floor(this.carriedRealSeconds / this.realSecondsPerGameMinute);
    this.carriedRealSeconds -= gameMinutes * this.realSecondsPerGameMinute;
    return gameMinutes;
  }

  public snapshot(): ActiveTimeAccumulatorState {
    return { carriedRealSeconds: this.carriedRealSeconds };
  }
}
