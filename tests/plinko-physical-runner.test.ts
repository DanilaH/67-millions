import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import { summarizePhysicalDrops } from '../simulation/plinko/metrics';
import { runBarePhysicalDrops } from '../simulation/plinko/physicalRunner';

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
});
