import { balance } from '../../src/config/balance';
import { runBarePhysicalDrops } from './physicalRunner';
import { summarizePhysicalDrops } from './metrics';

const runs = Number(process.env.PLINKO_BIAS_PROBE_RUNS ?? 5000);
const seed = Number(process.env.PLINKO_BIAS_PROBE_SEED ?? 67_036_200);

const angles = [15, 25, 35, 45, 55, 65, 75];

const baseline = summarizePhysicalDrops(
  balance,
  runBarePhysicalDrops(balance, {
    runs,
    seed,
    batchSize: 256,
    jackpotBiasLevel: 0,
  }),
);

const candidates = [];

for (const angleDegrees of angles) {
  const config = structuredClone(balance);
  config.plinko.jackpotBias[0] = {
    ...config.plinko.jackpotBias[0]!,
    deflectorOffsetX: 174,
    deflectorY: 320,
    length: 36,
    thickness: 5,
    angleDegrees,
    restitution: 0.75,
  };

  const metrics = summarizePhysicalDrops(
    config,
    runBarePhysicalDrops(config, {
      runs,
      seed,
      batchSize: 256,
      jackpotBiasLevel: 1,
    }),
  );

  candidates.push({
    angleDegrees,
    edgePocketProbability: metrics.edgePocketProbability,
    edgeDelta: metrics.edgePocketProbability - baseline.edgePocketProbability,
    ev: metrics.ev,
    combinedCenterProbability: metrics.combinedCenterProbability,
    symmetryDelta: metrics.symmetryDelta,
    stuckRate: metrics.stuckRate,
    p95CascadeSeconds: metrics.p95CascadeSeconds,
    maxCascadeSeconds: metrics.maxCascadeSeconds,
  });
}

process.stdout.write(JSON.stringify({
  runs,
  seed,
  baseline: {
    edgePocketProbability: baseline.edgePocketProbability,
    ev: baseline.ev,
    symmetryDelta: baseline.symmetryDelta,
    stuckRate: baseline.stuckRate,
  },
  candidates,
}, null, 2) + '\n');
