import type { BalanceConfig } from '../../src/config/balance.schema';
import type { PhysicalDropSample } from './physicalRunner';

export interface PhysicalRunnerMetrics {
  runs: number;
  resolvedRuns: number;
  stuckRuns: number;
  stuckRate: number;
  pocketCounts: number[];
  pocketFrequencies: number[];
  ev: number;
  medianMultiplier: number;
  standardDeviation: number;
  probabilityBelow1x: number;
  probabilityAtLeast2x: number;
  probabilityAtLeast5x: number;
  probabilityAtLeast10x: number;
  edgePocketProbability: number;
  p95Multiplier: number;
  p99Multiplier: number;
  meanCollisions: number;
  meanCascadeSeconds: number;
  p95CascadeSeconds: number;
  maxCascadeSeconds: number;
  symmetryDelta: number;
  childBallCount: number;
  returnCount: number;
}

const quantileSorted = (sorted: readonly number[], quantile: number): number => {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(quantile * sorted.length) - 1),
  );
  return sorted[index]!;
};

const mean = (values: readonly number[]): number =>
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;

export const summarizePhysicalDrops = (
  config: BalanceConfig,
  samples: readonly PhysicalDropSample[],
): PhysicalRunnerMetrics => {
  const resolved = samples.filter((sample) => !sample.stuck && sample.pocketIndex !== null);
  const multipliers = resolved.map((sample) => sample.multiplier).sort((a, b) => a - b);
  const pocketCounts = Array.from({ length: config.plinko.basePockets.length }, () => 0);

  for (const sample of resolved) {
    pocketCounts[sample.pocketIndex!] += 1;
  }

  const resolvedRuns = resolved.length;
  const pocketFrequencies = pocketCounts.map((count) =>
    resolvedRuns === 0 ? 0 : count / resolvedRuns,
  );
  const ev = mean(multipliers);
  const variance =
    multipliers.length === 0
      ? 0
      : mean(multipliers.map((value) => (value - ev) ** 2));
  const durationSeconds = resolved
    .map((sample) => sample.ticks / config.plinko.geometry.fixedTimestepHz)
    .sort((a, b) => a - b);

  let symmetryDelta = 0;
  for (let left = 0; left < Math.floor(pocketFrequencies.length / 2); left += 1) {
    const right = pocketFrequencies.length - 1 - left;
    symmetryDelta = Math.max(
      symmetryDelta,
      Math.abs(pocketFrequencies[left]! - pocketFrequencies[right]!),
    );
  }

  const ratio = (predicate: (value: number) => boolean): number =>
    resolvedRuns === 0 ? 0 : multipliers.filter(predicate).length / resolvedRuns;

  return {
    runs: samples.length,
    resolvedRuns,
    stuckRuns: samples.length - resolvedRuns,
    stuckRate: samples.length === 0 ? 0 : (samples.length - resolvedRuns) / samples.length,
    pocketCounts,
    pocketFrequencies,
    ev,
    medianMultiplier: quantileSorted(multipliers, 0.5),
    standardDeviation: Math.sqrt(variance),
    probabilityBelow1x: ratio((value) => value < 1),
    probabilityAtLeast2x: ratio((value) => value >= 2),
    probabilityAtLeast5x: ratio((value) => value >= 5),
    probabilityAtLeast10x: ratio((value) => value >= 10),
    edgePocketProbability:
      resolvedRuns === 0
        ? 0
        : (pocketCounts[0]! + pocketCounts[pocketCounts.length - 1]!) / resolvedRuns,
    p95Multiplier: quantileSorted(multipliers, 0.95),
    p99Multiplier: quantileSorted(multipliers, 0.99),
    meanCollisions: mean(resolved.map((sample) => sample.collisions)),
    meanCascadeSeconds: mean(durationSeconds),
    p95CascadeSeconds: quantileSorted(durationSeconds, 0.95),
    maxCascadeSeconds: durationSeconds.at(-1) ?? 0,
    symmetryDelta,
    childBallCount: 0,
    returnCount: 0,
  };
};
