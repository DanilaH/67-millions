import type { BalanceConfig } from '../../src/config/balance.schema';
import type { CascadeDropSample } from './cascadeRunner';

export interface CascadeMetrics {
  runs: number;
  resolvedRuns: number;
  stuckRuns: number;
  stuckRate: number;
  ev: number;
  medianMultiplier: number;
  standardDeviation: number;
  probabilityBelow1x: number;
  probabilityAtLeast2x: number;
  probabilityAtLeast5x: number;
  probabilityAtLeast10x: number;
  meanTerminalBalls: number;
  maxTerminalBalls: number;
  meanChildBalls: number;
  meanReturns: number;
  meanAmplifierProcs: number;
  meanMaxActiveBalls: number;
  maxActiveBalls: number;
  meanCascadeSeconds: number;
  p95CascadeSeconds: number;
  maxCascadeSeconds: number;
  terminalPocketCounts: number[];
}

const mean = (values: readonly number[]): number =>
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;

const quantileSorted = (
  sorted: readonly number[],
  quantile: number,
): number => {
  if (sorted.length === 0) return 0;

  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * quantile) - 1),
  );
  return sorted[index]!;
};

export const summarizeCascadeDrops = (
  config: BalanceConfig,
  samples: readonly CascadeDropSample[],
): CascadeMetrics => {
  const resolved = samples.filter((sample) => !sample.stuck);
  const multipliers = resolved
    .map((sample) => sample.aggregateMultiplier)
    .sort((left, right) => left - right);
  const ev = mean(multipliers);
  const variance =
    multipliers.length === 0
      ? 0
      : mean(
          multipliers.map(
            (value) => (value - ev) ** 2,
          ),
        );

  const durations = resolved
    .map(
      (sample) =>
        sample.ticks / config.plinko.geometry.fixedTimestepHz,
    )
    .sort((left, right) => left - right);

  const terminalPocketCounts = Array.from(
    { length: config.plinko.basePockets.length },
    () => 0,
  );

  for (const sample of resolved) {
    for (
      let index = 0;
      index < sample.pocketCounts.length;
      index += 1
    ) {
      terminalPocketCounts[index] =
        (terminalPocketCounts[index] ?? 0) +
        (sample.pocketCounts[index] ?? 0);
    }
  }

  const ratio = (
    predicate: (value: number) => boolean,
  ): number =>
    resolved.length === 0
      ? 0
      : multipliers.filter(predicate).length /
        resolved.length;

  return {
    runs: samples.length,
    resolvedRuns: resolved.length,
    stuckRuns: samples.length - resolved.length,
    stuckRate:
      samples.length === 0
        ? 0
        : (samples.length - resolved.length) /
          samples.length,
    ev,
    medianMultiplier: quantileSorted(multipliers, 0.5),
    standardDeviation: Math.sqrt(variance),
    probabilityBelow1x: ratio((value) => value < 1),
    probabilityAtLeast2x: ratio((value) => value >= 2),
    probabilityAtLeast5x: ratio((value) => value >= 5),
    probabilityAtLeast10x: ratio((value) => value >= 10),
    meanTerminalBalls: mean(
      resolved.map((sample) => sample.terminalBallCount),
    ),
    maxTerminalBalls: Math.max(
      0,
      ...resolved.map((sample) => sample.terminalBallCount),
    ),
    meanChildBalls: mean(
      resolved.map((sample) => sample.childBallCount),
    ),
    meanReturns: mean(
      resolved.map((sample) => sample.returnCount),
    ),
    meanAmplifierProcs: mean(
      resolved.map((sample) => sample.amplifierProcCount),
    ),
    meanMaxActiveBalls: mean(
      resolved.map((sample) => sample.maxActiveBalls),
    ),
    maxActiveBalls: Math.max(
      0,
      ...resolved.map((sample) => sample.maxActiveBalls),
    ),
    meanCascadeSeconds: mean(durations),
    p95CascadeSeconds: quantileSorted(durations, 0.95),
    maxCascadeSeconds: durations.at(-1) ?? 0,
    terminalPocketCounts,
  };
};
