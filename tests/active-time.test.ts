import { describe, expect, it } from 'vitest';

import { ActiveTimeAccumulator } from '../src/core/time/ActiveTimeAccumulator';

describe('ActiveTimeAccumulator', () => {
  it('advances only from active real time', () => {
    const time = new ActiveTimeAccumulator(3);

    expect(time.consume(6, true)).toBe(2);
    expect(time.consume(30, false)).toBe(0);
    expect(time.consume(3, true)).toBe(1);
  });

  it('preserves sub-minute active remainder without wall-clock catch-up', () => {
    const time = new ActiveTimeAccumulator(3);
    expect(time.consume(2, true)).toBe(0);

    const restored = new ActiveTimeAccumulator(3, time.snapshot());
    expect(restored.consume(1, true)).toBe(1);
  });
});
