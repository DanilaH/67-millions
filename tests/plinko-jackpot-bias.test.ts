import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import { deriveJackpotBiasGeometry } from '../src/core/plinko-rules/jackpotBias';

describe('Jackpot Bias geometry', () => {
  it('derives no geometry at level zero', () => {
    expect(deriveJackpotBiasGeometry(balance, 0)).toEqual([]);
  });

  it('derives a mirror-symmetric bumper pair for every configured level', () => {
    for (const level of balance.plinko.jackpotBias) {
      const bumpers = deriveJackpotBiasGeometry(balance, level.level);
      expect(bumpers).toHaveLength(level.deflectorPairs.length * 2);

      for (let pairIndex = 0; pairIndex < level.deflectorPairs.length; pairIndex += 1) {
        const pair = bumpers.filter(
          (bumper) => bumper.pairIndex === pairIndex,
        );
        expect(pair).toHaveLength(2);
        const left = pair.find((bumper) => bumper.side === 'left')!;
        const right = pair.find((bumper) => bumper.side === 'right')!;

        expect(left.x + right.x).toBeCloseTo(
          balance.plinko.geometry.centerX * 2,
        );
        expect(left.y).toBe(right.y);
        expect(left.length).toBe(right.length);
        expect(left.thickness).toBe(right.thickness);
        expect(left.angleRadians).toBeCloseTo(-right.angleRadians);
        expect(left.restitution).toBe(right.restitution);
      }
    }
  });

  it('fails fast for an unknown Bias level', () => {
    expect(() =>
      deriveJackpotBiasGeometry(balance, 999),
    ).toThrow('Jackpot Bias');
  });
});
