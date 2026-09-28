import { balance } from '../../src/config/balance';
import { runCascadePhysicalDrops } from './cascadeRunner';
import { summarizeCascadeDrops } from './cascadeMetrics';

const clearances = [1, 3, 5, 7, 9] as const;
const runs = Number(process.env.PLINKO_POCKET_CLEARANCE_SWEEP_RUNS ?? 30_000);
const seed = Number(process.env.PLINKO_POCKET_CLEARANCE_SWEEP_SEED ?? 67_035_000);

const rows = clearances.map((pocketEntryClearancePx) => {
  const config = structuredClone(balance);
  config.plinko.geometry.pocketEntryClearancePx = pocketEntryClearancePx;

  const samples = runCascadePhysicalDrops(config, {
    runs,
    seed,
    stake: 100_000,
    batchSize: 64,
    pocketMultipliers: config.plinko.basePockets,
    specialLevels: {
      amplifierLevel: 0,
      returnLevel: 0,
      splitterLevel: 0,
    },
  });
  const metrics = summarizeCascadeDrops(config, samples);

  const totalTerminal = metrics.terminalPocketCounts.reduce(
    (sum, count) => sum + count,
    0,
  );
  const centerPair =
    (metrics.terminalPocketCounts[4] ?? 0) +
    (metrics.terminalPocketCounts[5] ?? 0);
  const mirrorDeltas = Array.from(
    { length: Math.floor(metrics.terminalPocketCounts.length / 2) },
    (_, index) => {
      const left = metrics.terminalPocketCounts[index] ?? 0;
      const right =
        metrics.terminalPocketCounts[
          metrics.terminalPocketCounts.length - 1 - index
        ] ?? 0;
      return totalTerminal === 0
        ? 0
        : Math.abs(left - right) / totalTerminal;
    },
  );

  return {
    pocketEntryClearancePx,
    ev: metrics.ev,
    stuckRuns: metrics.stuckRuns,
    stuckRate: metrics.stuckRate,
    centerCombined:
      totalTerminal === 0 ? 0 : centerPair / totalTerminal,
    maxMirrorDelta: Math.max(0, ...mirrorDeltas),
    p95CascadeSeconds: metrics.p95CascadeSeconds,
    maxCascadeSeconds: metrics.maxCascadeSeconds,
    stuckDiagnostics: samples.flatMap((sample, dropIndex) =>
      sample.stuck
        ? [{ dropIndex, balls: sample.stuckBalls }]
        : [],
    ),
  };
});

process.stdout.write(
  JSON.stringify(
    {
      runs,
      seed,
      note:
        'Paired geometry sweep: every clearance sees identical Drop RNG seeds. 30k includes known pathological Drop index 26458.',
      rows,
    },
    null,
    2,
  ) + '\n',
);
