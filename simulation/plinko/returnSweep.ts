import { balance } from '../../src/config/balance';
import { runCascadePhysicalDrops } from './cascadeRunner';
import { summarizeCascadeDrops } from './cascadeMetrics';

const retentions = [0, 0.25, 0.5, 0.75, 1] as const;
const levels = [1, 4] as const;
const runs = Number(process.env.PLINKO_RETURN_SWEEP_RUNS ?? 10_000);
const seed = Number(process.env.PLINKO_RETURN_SWEEP_SEED ?? 67035111);

const rows = [];

for (const level of levels) {
  for (const horizontalRetention of retentions) {
    const config = structuredClone(balance);
    config.plinko.returnPhysics.horizontalRetention = horizontalRetention;

    const samples = runCascadePhysicalDrops(config, {
      runs,
      // Paired experiment: every retention sees the exact same per-Drop RNG
      // sequence for a given Return level. This isolates Return physics from
      // jackpot-tail sampling noise.
      seed: seed + level * 1000,
      stake: 100_000,
      batchSize: 64,
      pocketMultipliers: config.plinko.basePockets,
      specialLevels: {
        amplifierLevel: 0,
        returnLevel: level,
        splitterLevel: 0,
      },
    });
    const metrics = summarizeCascadeDrops(config, samples);

    rows.push({
      level,
      horizontalRetention,
      ev: metrics.ev,
      stuckRate: metrics.stuckRate,
      meanReturns: metrics.meanReturns,
      probabilityBelow1x: metrics.probabilityBelow1x,
      meanCascadeSeconds: metrics.meanCascadeSeconds,
      p95CascadeSeconds: metrics.p95CascadeSeconds,
      maxCascadeSeconds: metrics.maxCascadeSeconds,
    });
  }
}

process.stdout.write(JSON.stringify({ runs, seed, rows }, null, 2) + '\n');

const configured = rows.filter(
  (row) =>
    row.horizontalRetention ===
    balance.plinko.returnPhysics.horizontalRetention,
);

if (configured.some((row) => row.stuckRate > 0)) {
  process.exitCode = 2;
}
