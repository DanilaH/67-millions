import { balance } from '../../src/config/balance';
import { runCascadePhysicalDrops } from './cascadeRunner';
import { summarizeCascadeDrops } from './cascadeMetrics';

const overlaps = [0, 2, 3, 4, 6] as const;
const baselineRuns = Number(
  process.env.PLINKO_DIVIDER_OVERLAP_BASELINE_RUNS ?? 30_000,
);
const combinedRuns = Number(
  process.env.PLINKO_DIVIDER_OVERLAP_COMBINED_RUNS ?? 5_000,
);
const seed = Number(
  process.env.PLINKO_DIVIDER_OVERLAP_SEED ?? 67_035_000,
);

const summarize = (
  config: typeof balance,
  runs: number,
  specialLevels: {
    amplifierLevel: number;
    returnLevel: number;
    splitterLevel: number;
    jackpotBiasLevel: number;
  },
) => {
  const samples = runCascadePhysicalDrops(config, {
    runs,
    seed,
    stake: 100_000,
    batchSize: 64,
    pocketMultipliers: config.plinko.basePockets,
    specialLevels,
  });
  const metrics = summarizeCascadeDrops(config, samples);

  const totalTerminal = metrics.terminalPocketCounts.reduce(
    (sum, count) => sum + count,
    0,
  );
  const centerPair =
    (metrics.terminalPocketCounts[4] ?? 0) +
    (metrics.terminalPocketCounts[5] ?? 0);
  const maxMirrorDelta = Math.max(
    0,
    ...Array.from(
      {
        length: Math.floor(
          metrics.terminalPocketCounts.length / 2,
        ),
      },
      (_, index) => {
        const left =
          metrics.terminalPocketCounts[index] ?? 0;
        const right =
          metrics.terminalPocketCounts[
            metrics.terminalPocketCounts.length - 1 - index
          ] ?? 0;
        return totalTerminal === 0
          ? 0
          : Math.abs(left - right) / totalTerminal;
      },
    ),
  );

  return {
    ev: metrics.ev,
    stuckRuns: metrics.stuckRuns,
    stuckRate: metrics.stuckRate,
    centerCombined:
      totalTerminal === 0 ? 0 : centerPair / totalTerminal,
    maxMirrorDelta,
    p95CascadeSeconds: metrics.p95CascadeSeconds,
    maxCascadeSeconds: metrics.maxCascadeSeconds,
    meanTerminalBalls: metrics.meanTerminalBalls,
    meanChildBalls: metrics.meanChildBalls,
    stuckDiagnostics: samples.flatMap((sample, dropIndex) =>
      sample.stuck
        ? [{ dropIndex, balls: sample.stuckBalls }]
        : [],
    ),
  };
};

const rows = overlaps.map((pocketDividerPegOverlapPx) => {
  const config = structuredClone(balance);
  config.plinko.geometry.pocketDividerPegOverlapPx =
    pocketDividerPegOverlapPx;

  return {
    pocketDividerPegOverlapPx,
    dividerTopY:
      config.plinko.geometry.topPegY +
      (config.plinko.rows - 1) *
        config.plinko.geometry.verticalPegSpacing +
      config.plinko.geometry.pegRadius -
      pocketDividerPegOverlapPx,
    baseline: summarize(config, baselineRuns, {
      amplifierLevel: 0,
      returnLevel: 0,
      splitterLevel: 0,
      jackpotBiasLevel: 0,
    }),
    combinedMax: summarize(config, combinedRuns, {
      amplifierLevel: config.plinko.amplifier.at(-1)!.level,
      returnLevel: config.plinko.return.at(-1)!.level,
      splitterLevel: config.plinko.splitter.at(-1)!.level,
      jackpotBiasLevel: 0,
    }),
  };
});

process.stdout.write(
  JSON.stringify(
    {
      baselineRuns,
      combinedRuns,
      seed,
      note:
        'Paired sweep. Baseline 30k includes historical trap #26458; combined-max 5k includes child traps #2031/#3191.',
      rows,
    },
    null,
    2,
  ) + '\n',
);
