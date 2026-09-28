import { balance } from '../../src/config/balance';
import { runBarePhysicalDrops } from './physicalRunner';
import { summarizePhysicalDrops } from './metrics';

const runs = Number(process.env.PLINKO_BIAS_PROBE_RUNS ?? 3000);
const seed = Number(process.env.PLINKO_BIAS_PROBE_SEED ?? 67_036_100);

const offsets = [182, 178, 174, 170, 166, 162];
const lengths = [32, 36, 40, 44];

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

for (const deflectorOffsetX of offsets) {
  for (const length of lengths) {
    const config = structuredClone(balance);
    config.plinko.jackpotBias[0] = {
      ...config.plinko.jackpotBias[0]!,
      deflectorOffsetX,
      deflectorY: 320,
      length,
      thickness: 5,
      angleDegrees: 45,
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
      deflectorOffsetX,
      length,
      edgePocketProbability: metrics.edgePocketProbability,
      edgeDelta: metrics.edgePocketProbability - baseline.edgePocketProbability,
      ev: metrics.ev,
      symmetryDelta: metrics.symmetryDelta,
      stuckRate: metrics.stuckRate,
      p95CascadeSeconds: metrics.p95CascadeSeconds,
      maxCascadeSeconds: metrics.maxCascadeSeconds,
    });
  }
}

candidates.sort((a, b) =>
  b.edgePocketProbability - a.edgePocketProbability ||
  a.stuckRate - b.stuckRate ||
  a.symmetryDelta - b.symmetryDelta
);

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
