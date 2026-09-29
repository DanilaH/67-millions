import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import { derivePocketMultipliers } from '../src/core/plinko-rules/progression';
import { runCascadePhysicalDrops } from '../simulation/plinko/cascadeRunner';
import { summarizeCascadeDrops } from '../simulation/plinko/cascadeMetrics';

describe('Plinko cascade physical runner', () => {
  it('is deterministic for the same seed and special levels', () => {
    const options = {
      runs: 32,
      seed: 123456,
      stake: 100_000,
      batchSize: 8,
      maxTicks: 1200,
      pocketMultipliers: derivePocketMultipliers(balance, {
        centerLevel: 0,
        midLevel: 0,
        jackpotLevel: 0,
      }),
      specialLevels: {
        amplifierLevel: 2,
        returnLevel: 1,
        splitterLevel: 1,
        jackpotBiasLevel: 0,
      },
    };

    expect(runCascadePhysicalDrops(balance, options)).toEqual(
      runCascadePhysicalDrops(balance, options),
    );
  });

  it('preserves the one-ball baseline when all special levels are zero', () => {
    const samples = runCascadePhysicalDrops(balance, {
      runs: 64,
      seed: 98765,
      stake: 100_000,
      batchSize: 16,
      maxTicks: 1200,
      pocketMultipliers: balance.plinko.basePockets,
      specialLevels: {
        amplifierLevel: 0,
        returnLevel: 0,
        splitterLevel: 0,
        jackpotBiasLevel: 0,
      },
    });

    expect(samples.every((sample) => sample.childBallCount === 0)).toBe(true);
    expect(samples.every((sample) => sample.returnCount === 0)).toBe(true);
    expect(samples.every((sample) => sample.amplifierProcCount === 0)).toBe(true);
    expect(samples.every((sample) => sample.maxActiveBalls === 1)).toBe(true);

    const metrics = summarizeCascadeDrops(balance, samples);
    expect(metrics.runs).toBe(64);
    expect(metrics.maxActiveBalls).toBe(1);
  });

  it('resolves a synthetic 24-ball single-Drop stress state without exceeding the production cap', () => {
    const samples = runCascadePhysicalDrops(balance, {
      runs: 4,
      seed: 67_049_000,
      stake: 100_000,
      batchSize: 1,
      initialBallCount: balance.plinko.maxActiveBalls,
      maxTicks: 3600,
      pocketMultipliers: derivePocketMultipliers(balance, {
        centerLevel: 2,
        midLevel: 3,
        jackpotLevel: 3,
      }),
      specialLevels: {
        amplifierLevel: 5,
        returnLevel: 4,
        splitterLevel: 5,
        jackpotBiasLevel: 4,
      },
    });

    expect(samples).toHaveLength(4);
    expect(
      samples.every(
        (sample) =>
          sample.maxActiveBalls === balance.plinko.maxActiveBalls,
      ),
    ).toBe(true);
    expect(
      samples.every(
        (sample) =>
          sample.terminalBallCount === balance.plinko.maxActiveBalls,
      ),
    ).toBe(true);
    expect(samples.every((sample) => !sample.stuck)).toBe(true);
  });

  it('rejects a synthetic initial ball count above the production cap', () => {
    expect(() =>
      runCascadePhysicalDrops(balance, {
        runs: 1,
        seed: 67_049_001,
        stake: 100_000,
        batchSize: 1,
        initialBallCount: balance.plinko.maxActiveBalls + 1,
        pocketMultipliers: balance.plinko.basePockets,
        specialLevels: {
          amplifierLevel: 0,
          returnLevel: 0,
          splitterLevel: 5,
          jackpotBiasLevel: 0,
        },
      }),
    ).toThrow('initialBallCount must be within');
  });

  it('never exceeds configured Splitter depth-derived active-ball cap in a stress smoke', () => {
    const maxSplitterLevel = balance.plinko.splitter.at(-1)!.level;
    const samples = runCascadePhysicalDrops(balance, {
      runs: 64,
      seed: 24680,
      stake: 100_000,
      batchSize: 8,
      maxTicks: 1800,
      pocketMultipliers: balance.plinko.basePockets,
      specialLevels: {
        amplifierLevel: 0,
        returnLevel: 0,
        splitterLevel: maxSplitterLevel,
        jackpotBiasLevel: 0,
      },
    });

    expect(
      Math.max(...samples.map((sample) => sample.maxActiveBalls)),
    ).toBeLessThanOrEqual(balance.plinko.maxActiveBalls);
  });
});
