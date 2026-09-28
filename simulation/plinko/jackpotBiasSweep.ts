import { balance } from '../../src/config/balance';
import { runBarePhysicalDrops } from './physicalRunner';
import { summarizePhysicalDrops } from './metrics';

const runs = Number(process.env.PLINKO_BIAS_SWEEP_RUNS ?? 10_000);
const seed = Number(process.env.PLINKO_BIAS_SWEEP_SEED ?? 67_036_000);

const rows = [];

for (let jackpotBiasLevel = 0; jackpotBiasLevel <= balance.plinko.jackpotBias.length; jackpotBiasLevel += 1) {
  const samples = runBarePhysicalDrops(balance, {
    runs,
    seed,
    batchSize: 256,
    jackpotBiasLevel,
  });
  const metrics = summarizePhysicalDrops(balance, samples);

  rows.push({
    jackpotBiasLevel,
    ev: metrics.ev,
    edgePocketProbability: metrics.edgePocketProbability,
    combinedCenterProbability: metrics.combinedCenterProbability,
    symmetryDelta: metrics.symmetryDelta,
    stuckRate: metrics.stuckRate,
    meanCascadeSeconds: metrics.meanCascadeSeconds,
    p95CascadeSeconds: metrics.p95CascadeSeconds,
    maxCascadeSeconds: metrics.maxCascadeSeconds,
    pocketFrequencies: metrics.pocketFrequencies,
  });
}

process.stdout.write(JSON.stringify({ runs, seed, rows }, null, 2) + '\n');

if (rows.some((row) => row.stuckRate > 0)) {
  process.exitCode = 2;
}
