import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import { summarizePhysicalDrops } from '../simulation/plinko/metrics';
import { runBarePhysicalDrops } from '../simulation/plinko/physicalRunner';
import { derivePocketMultipliers } from '../src/core/plinko-rules/progression';

describe('bare Plinko physical runner', () => {
  it('is reproducible for the same seed and resolves a small physical smoke run', () => {
    const options = { runs: 64, seed: 12345, batchSize: 16, maxTicks: 1200 };
    const first = runBarePhysicalDrops(balance, options);
    const second = runBarePhysicalDrops(balance, options);

    expect(first).toEqual(second);
    expect(first).toHaveLength(64);
    expect(first.some((sample) => sample.pocketIndex !== null)).toBe(true);

    const metrics = summarizePhysicalDrops(balance, first);
    expect(metrics.runs).toBe(64);
    expect(metrics.pocketCounts).toHaveLength(balance.plinko.basePockets.length);
  });

  it('uses derived milestone pocket multipliers without changing physical routing', () => {
    const options = { runs: 64, seed: 222, batchSize: 16, maxTicks: 1200 };
    const bare = runBarePhysicalDrops(balance, options);
    const milestonePockets = derivePocketMultipliers(balance, {
      centerLevel: 2,
      midLevel: 1,
      jackpotLevel: 1,
    });
    const milestone = runBarePhysicalDrops(balance, {
      ...options,
      pocketMultipliers: milestonePockets,
    });

    expect(milestone.map((sample) => sample.pocketIndex)).toEqual(
      bare.map((sample) => sample.pocketIndex),
    );

    const changed = milestone.filter(
      (sample, index) => sample.multiplier !== bare[index]?.multiplier,
    );
    expect(changed.length).toBeGreaterThan(0);
  });
});
