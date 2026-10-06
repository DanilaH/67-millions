import { describe, expect, it } from 'vitest';
import { balance } from '../src/config/balance';
import { getReturnTarget } from '../src/core/plinko-rules/returnPhysics';
import { deriveJackpotBiasGeometry } from '../src/core/plinko-rules/jackpotBias';
import { deriveBarePlinkoLayout } from '../src/core/plinko-rules/boardLayout';

describe('playtest return and guide geometry', () => {
  it('moves early returns halfway inward on either side, preserving late returns', () => {
    const center = balance.plinko.geometry.centerX;
    for (const sign of [-1, 1]) for (const level of [1, 2, 3, 4]) {
      const target = getReturnTarget(balance, center + sign * 120, level);
      expect(target.x).toBe(center + sign * (level <= 2 ? 60 : 120));
      expect(target.y).toBe(balance.plinko.geometry.topPegY - balance.plinko.geometry.verticalPegSpacing);
    }
  });
  it('keeps historical same-X return when no per-level map exists', () => {
    const old = structuredClone(balance);
    delete old.plinko.returnPhysics.horizontalRetentionByLevel;
    for (const level of [1, 2, 3, 4]) expect(getReturnTarget(old, 500, level).x).toBe(500);
    expect(() => getReturnTarget(balance, 500, 0)).toThrow('level');
  });
  it('hides both inner guide corners inside the neighbouring physical peg', () => {
    const pegs = deriveBarePlinkoLayout(balance).pegs;
    for (const guide of deriveJackpotBiasGeometry(balance, 4)) {
      const side = guide.side === 'right' ? -1 : 1;
      const x = guide.x + side * guide.length / 2 * Math.cos(guide.angleRadians);
      const y = guide.y + side * guide.length / 2 * Math.sin(guide.angleRadians);
      const nearest = pegs.reduce((a,b) => Math.hypot(a.x-x,a.y-y)<Math.hypot(b.x-x,b.y-y)?a:b);
      for (const edge of [-1, 1]) {
        const cx = x - edge * guide.thickness / 2 * Math.sin(guide.angleRadians);
        const cy = y + edge * guide.thickness / 2 * Math.cos(guide.angleRadians);
        // Conservative inner radius of Matter's minimum 10-sided circle polygon.
        expect(Math.hypot(cx-nearest.x,cy-nearest.y)).toBeLessThan(balance.plinko.geometry.pegRadius * Math.cos(Math.PI/10));
      }
    }
  });
});
