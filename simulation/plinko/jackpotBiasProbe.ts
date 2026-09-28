import { balance } from '../../src/config/balance';
import { runBarePhysicalDrops } from './physicalRunner';
import { summarizePhysicalDrops } from './metrics';

const runs = Number(process.env.PLINKO_BIAS_PROBE_RUNS ?? 3000);
const seed = Number(process.env.PLINKO_BIAS_PROBE_SEED ?? 67_036_500);

const offsets = [110, 114, 118, 122, 126, 130, 134];
const ys = [239, 245, 251];

const baselineL3 = summarizePhysicalDrops(
  balance,
  runBarePhysicalDrops(balance, {
    runs,
    seed,
    batchSize: 256,
    jackpotBiasLevel: 3,
  }),
);

const candidates = [];

for (const deflectorY of ys) {
  for (const deflectorOffsetX of offsets) {
    const config = structuredClone(balance);
    const firstThree =
      config.plinko.jackpotBias[2]!.deflectorPairs.map(
        (pair) => ({ ...pair }),
      );

    config.plinko.jackpotBias[3] = {
      ...config.plinko.jackpotBias[3]!,
      deflectorPairs: [
        ...firstThree,
        {
          deflectorOffsetX,
          deflectorY,
          length: 36,
          thickness: 5,
          angleDegrees: 25,
          restitution: 0.75,
        },
      ],
    };

    const metrics = summarizePhysicalDrops(
      config,
      runBarePhysicalDrops(config, {
        runs,
        seed,
        batchSize: 256,
        jackpotBiasLevel: 4,
      }),
    );

    candidates.push({
      deflectorOffsetX,
      deflectorY,
      edgePocketProbability: metrics.edgePocketProbability,
      edgeDeltaFromL3:
        metrics.edgePocketProbability -
        baselineL3.edgePocketProbability,
      ev: metrics.ev,
      evDeltaFromL3: metrics.ev - baselineL3.ev,
      combinedCenterProbability:
        metrics.combinedCenterProbability,
      symmetryDelta: metrics.symmetryDelta,
      stuckRate: metrics.stuckRate,
      p95CascadeSeconds: metrics.p95CascadeSeconds,
      maxCascadeSeconds: metrics.maxCascadeSeconds,
    });
  }
}

candidates.sort((a, b) => {
  const aBad = a.stuckRate > 0 ? 1 : 0;
  const bBad = b.stuckRate > 0 ? 1 : 0;
  if (aBad !== bBad) return aBad - bBad;

  const targetEdge = baselineL3.edgePocketProbability + 0.02;
  return (
    Math.abs(a.edgePocketProbability - targetEdge) -
      Math.abs(b.edgePocketProbability - targetEdge) ||
    a.symmetryDelta - b.symmetryDelta
  );
});

process.stdout.write(
  JSON.stringify(
    {
      runs,
      seed,
      baselineL3: {
        edgePocketProbability:
          baselineL3.edgePocketProbability,
        ev: baselineL3.ev,
        symmetryDelta: baselineL3.symmetryDelta,
        stuckRate: baselineL3.stuckRate,
      },
      candidates,
    },
    null,
    2,
  ) + '\n',
);
