import type { RandomSource } from '@danilah/mini-games-kit/core';

export interface SeededRandomState {
  state: number;
}

const FALLBACK_SEED = 0x6d2b79f5;

const normalizeSeed = (seed: number): number => {
  if (!Number.isFinite(seed)) throw new TypeError('Seed must be finite');
  const value = seed >>> 0;
  return value === 0 ? FALLBACK_SEED : value;
};

export class SeededRandom implements RandomSource {
  private state: number;

  public constructor(seedOrState: number | SeededRandomState) {
    this.state = normalizeSeed(
      typeof seedOrState === 'number' ? seedOrState : seedOrState.state,
    );
  }

  public next(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state / 0x1_0000_0000;
  }

  public snapshot(): SeededRandomState {
    return { state: this.state };
  }
}
