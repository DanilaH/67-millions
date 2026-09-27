import { balance } from '../../src/config/balance';
import { summarizePhysicalDrops } from './metrics';
import { runBarePhysicalDrops } from './physicalRunner';

interface Candidate {
  verticalSpacing: number;
  ballRestitution: number;
  pegRestitution: number;
  frictionAir: number;
  ev: number;
  combinedCenterProbability: number;
  edgePocketProbability: number;
  symmetryDelta: number;
  stuckRate: number;
  galtonShapeL1Error: number;
  score: number;
  pocketFrequencies: number[];
}

const candidates: Candidate[] = [];

for (const verticalSpacing of [27, 28]) {
  for (const ballRestitution of [0.15, 0.18, 0.2]) {
    for (const pegRestitution of [0.55, 0.6, 0.65]) {
      for (const frictionAir of [0.022, 0.024, 0.026]) {
        const config = structuredClone(balance);
        config.plinko.geometry.verticalPegSpacing = verticalSpacing;
        config.plinko.physicsSeed.ballRestitution = ballRestitution;
        config.plinko.physicsSeed.pegRestitution = pegRestitution;
        config.plinko.physicsSeed.frictionAir = frictionAir;

        const samples = runBarePhysicalDrops(config, {
          runs: 1000,
          seed: 67_000_000,
          batchSize: 100,
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
          verticalSpacing,
          ballRestitution,
          pegRestitution,
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
  }
}

candidates.sort((left, right) => left.score - right.score);
process.stdout.write(JSON.stringify(candidates.slice(0, 15), null, 2) + '\n');
