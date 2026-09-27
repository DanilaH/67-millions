import { balance } from '../../src/config/balance';
import { summarizePhysicalDrops } from './metrics';
import { runBarePhysicalDrops } from './physicalRunner';

const candidates = [];

for (const ballRestitution of [0.155, 0.16, 0.165]) {
  for (const frictionAir of [0.023, 0.02325, 0.0235, 0.02375]) {
    const config = structuredClone(balance);
    config.plinko.geometry.verticalPegSpacing = 27;
    config.plinko.physicsSeed.ballRestitution = ballRestitution;
    config.plinko.physicsSeed.pegRestitution = 0.6;
    config.plinko.physicsSeed.frictionAir = frictionAir;

    const samples = runBarePhysicalDrops(config, {
      runs: 5000,
      seed: 67_000_000,
      batchSize: 200,
      maxTicks: config.plinko.geometry.fixedTimestepHz * 12,
    });
    const metrics = summarizePhysicalDrops(config, samples);

    const centerError = Math.abs(metrics.combinedCenterProbability - 0.4921875);
    const edgeError = Math.abs(
      metrics.edgePocketProbability - metrics.idealEdgeProbability,
    );
    const evError = Math.abs(metrics.ev - config.plinko.targetBareEV);
    const centerPenalty =
      metrics.combinedCenterProbability < 0.45 ||
      metrics.combinedCenterProbability > 0.54
        ? 2
        : 0;

    candidates.push({
      ballRestitution,
      frictionAir,
      ev: metrics.ev,
      combinedCenterProbability: metrics.combinedCenterProbability,
      edgePocketProbability: metrics.edgePocketProbability,
      symmetryDelta: metrics.symmetryDelta,
      stuckRate: metrics.stuckRate,
      galtonShapeL1Error: metrics.galtonShapeL1Error,
      score:
        metrics.galtonShapeL1Error +
        centerError * 2 +
        edgeError * 2 +
        evError +
        metrics.symmetryDelta +
        metrics.stuckRate * 20 +
        centerPenalty,
      pocketFrequencies: metrics.pocketFrequencies,
    });
  }
}

candidates.sort((left, right) => left.score - right.score);
process.stdout.write(JSON.stringify(candidates, null, 2) + '\n');
