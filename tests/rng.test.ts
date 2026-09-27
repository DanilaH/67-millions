import { describe, expect, it } from 'vitest';

import { SeededRandom } from '../src/core/rng/SeededRandom';

describe('SeededRandom', () => {
  it('is deterministic for the same seed', () => {
    const a = new SeededRandom(123456);
    const b = new SeededRandom(123456);
    expect(Array.from({ length: 20 }, () => a.next())).toEqual(
      Array.from({ length: 20 }, () => b.next()),
    );
  });

  it('resumes exactly from serialized state', () => {
    const source = new SeededRandom(42);
    source.next();
    source.next();
    const restored = new SeededRandom(source.snapshot());
    expect(restored.next()).toBe(source.next());
  });
});
