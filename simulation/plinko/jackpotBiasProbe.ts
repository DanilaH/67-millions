import { balance } from '../../src/config/balance';
import { runBarePhysicalDrops } from './physicalRunner';
import { summarizePhysicalDrops } from './metrics';

const runs = Number(process.env.PLINKO_BIAS_PROBE_RUNS ?? 5000);
const seed = Number(process.env.PLINKO_BIAS_PROBE_SEED ?? 67_036_600);

const offsets = [104, 105, 106, 107, 108, 109, 110];

const baselineL3 = summarizePhysicalDrops(
  balance,
  runBarePhysicalDrops(balance, {
    runs,
    seed,
    batchSize: 256,
    jackpotBiasLevel: 3,
  }),
);

const candidates = offsets.map((deflectorOffsetX) => {
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
        deflectorY: 239,
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

  return {
    deflectorOffsetX,
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
  };
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
