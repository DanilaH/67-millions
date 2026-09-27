import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import {
  deriveBarePlinkoLayout,
  getSpawnX,
} from '../src/core/plinko-rules/boardLayout';

describe('bare Plinko layout', () => {
  it('derives a 9-row Galton board and 10 pockets from config', () => {
    const layout = deriveBarePlinkoLayout(balance);

    expect(layout.pegs).toHaveLength(45);
    expect(layout.pocketCenters).toHaveLength(10);
    expect(layout.pocketCenters[0]!.x).toBeCloseTo(
      balance.plinko.geometry.centerX -
        (9 * balance.plinko.geometry.pocketCenterSpacing) / 2,
    );
  });

  it('keeps every row centered and uses configured spacing', () => {
    const layout = deriveBarePlinkoLayout(balance);
    let offset = 0;

    for (let row = 0; row < balance.plinko.rows; row += 1) {
      const count = row + 1;
      const points = layout.pegs.slice(offset, offset + count);
      offset += count;

      expect(points[0]!.x + points.at(-1)!.x).toBeCloseTo(
        balance.plinko.geometry.centerX * 2,
      );

      for (let index = 1; index < points.length; index += 1) {
        expect(points[index]!.x - points[index - 1]!.x).toBeCloseTo(
          balance.plinko.geometry.horizontalPegSpacing,
        );
      }
    }
  });

  it('derives symmetric side guides that close the escape corridor without probability routing', () => {
    const layout = deriveBarePlinkoLayout(balance);
    const [left, right] = layout.sideGuides;

    expect(left.center.x + right.center.x).toBeCloseTo(
      balance.plinko.geometry.centerX * 2,
    );
    expect(left.center.y).toBeCloseTo(right.center.y);
    expect(left.length).toBeCloseTo(right.length);
    expect(left.angle).toBeCloseTo(Math.PI - right.angle);
  });

  it('spawns only inside configured seeded horizontal jitter', () => {
    const center = balance.plinko.geometry.centerX;
    const jitter = balance.plinko.geometry.spawnHorizontalJitterPx;

    expect(getSpawnX(balance, 0)).toBe(center - jitter);
    expect(getSpawnX(balance, 0.5)).toBe(center);
    expect(getSpawnX(balance, 0.999999)).toBeLessThanOrEqual(center + jitter);
  });
});
