import { balance } from '../../src/config/balance';
import { runBarePhysicalDrops } from './physicalRunner';
import { summarizePhysicalDrops } from './metrics';

const runs = Number(process.env.PLINKO_BIAS_PROBE_RUNS ?? 3000);
const seed = Number(process.env.PLINKO_BIAS_PROBE_SEED ?? 67_036_400);

const rows = [];

for (
  let jackpotBiasLevel = 0;
  jackpotBiasLevel <= balance.plinko.jackpotBias.length;
  jackpotBiasLevel += 1
) {
  const metrics = summarizePhysicalDrops(
    balance,
    runBarePhysicalDrops(balance, {
      runs,
      seed,
      batchSize: 256,
      jackpotBiasLevel,
    }),
  );

  rows.push({
    jackpotBiasLevel,
    deflectorPairCount:
      jackpotBiasLevel === 0
        ? 0
        : balance.plinko.jackpotBias[jackpotBiasLevel - 1]!.deflectorPairs.length,
    edgePocketProbability: metrics.edgePocketProbability,
    ev: metrics.ev,
    combinedCenterProbability: metrics.combinedCenterProbability,
    symmetryDelta: metrics.symmetryDelta,
    stuckRate: metrics.stuckRate,
    p95CascadeSeconds: metrics.p95CascadeSeconds,
    maxCascadeSeconds: metrics.maxCascadeSeconds,
  });
}

process.stdout.write(JSON.stringify({ runs, seed, rows }, null, 2) + '\n');
