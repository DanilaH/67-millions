import { balance } from '../../src/config/balance';
import { summarizePhysicalDrops } from './metrics';
import { runBarePhysicalDrops } from './physicalRunner';

const candidates = [];

for (const ballRestitution of [0.15, 0.155, 0.16, 0.165]) {
  for (const frictionAir of [0.02275, 0.023, 0.02325, 0.0235]) {
    const config = structuredClone(balance);
    config.plinko.geometry.verticalPegSpacing = 27;
    config.plinko.physicsSeed.gravityY = 1;
    config.plinko.physicsSeed.ballRestitution = ballRestitution;
    config.plinko.physicsSeed.pegRestitution = 0.6;
    config.plinko.physicsSeed.frictionAir = frictionAir;

    const samples = runBarePhysicalDrops(config, {
      runs: 1000,
      seed: 67_000_000,
      batchSize: 100,
      maxTicks: config.plinko.geometry.fixedTimestepHz * 12,
    });
    const metrics = summarizePhysicalDrops(config, samples);

    candidates.push({
      ballRestitution,
      frictionAir,
      ev: metrics.ev,
      combinedCenterProbability: metrics.combinedCenterProbability,
      edgePocketProbability: metrics.edgePocketProbability,
      symmetryDelta: metrics.symmetryDelta,
      stuckRate: metrics.stuckRate,
      galtonShapeL1Error: metrics.galtonShapeL1Error,
      pocketFrequencies: metrics.pocketFrequencies,
    });
  }
}

candidates.sort(
  (left, right) =>
    Math.abs(left.ev - balance.plinko.targetBareEV) -
    Math.abs(right.ev - balance.plinko.targetBareEV),
);

process.stdout.write(JSON.stringify(candidates, null, 2) + '\n');
