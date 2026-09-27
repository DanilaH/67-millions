import { balance } from '../../src/config/balance';
import { summarizePhysicalDrops } from './metrics';
import { runBarePhysicalDrops } from './physicalRunner';

interface Candidate {
  horizontalSpacing: number;
  verticalSpacing: number;
  ballRestitution: number;
  pegRestitution: number;
  frictionAir: number;
  ev: number;
  combinedCenterProbability: number;
  edgePocketProbability: number;
  stuckRate: number;
  galtonShapeL1Error: number;
  score: number;
  pocketFrequencies: number[];
}

const candidates: Candidate[] = [];
let index = 0;

for (const horizontalSpacing of [40, 44, 48]) {
  for (const verticalSpacing of [20, 24, 28, 32]) {
    for (const ballRestitution of [0.1, 0.3, 0.5]) {
      for (const pegRestitution of [0.15, 0.35, 0.55]) {
        for (const frictionAir of [0.003, 0.012, 0.025]) {
          const config = structuredClone(balance);
          config.plinko.geometry.horizontalPegSpacing = horizontalSpacing;
          config.plinko.geometry.pocketCenterSpacing = horizontalSpacing;
          config.plinko.geometry.verticalPegSpacing = verticalSpacing;
          config.plinko.physicsSeed.ballRestitution = ballRestitution;
          config.plinko.physicsSeed.pegRestitution = pegRestitution;
          config.plinko.physicsSeed.frictionAir = frictionAir;

          const samples = runBarePhysicalDrops(config, {
            runs: 200,
            seed: 67_000_000 + index * 7_919,
            batchSize: 100,
            maxTicks: config.plinko.geometry.fixedTimestepHz * 12,
          });
          index += 1;

          const metrics = summarizePhysicalDrops(config, samples);
          const centerError = Math.abs(metrics.combinedCenterProbability - 0.4921875);
          const edgeError = Math.abs(
            metrics.edgePocketProbability - metrics.idealEdgeProbability,
          );
          const evError = Math.abs(metrics.ev - config.plinko.targetBareEV);

          candidates.push({
            horizontalSpacing,
            verticalSpacing,
            ballRestitution,
            pegRestitution,
            frictionAir,
            ev: metrics.ev,
            combinedCenterProbability: metrics.combinedCenterProbability,
            edgePocketProbability: metrics.edgePocketProbability,
            stuckRate: metrics.stuckRate,
            galtonShapeL1Error: metrics.galtonShapeL1Error,
            score:
              metrics.galtonShapeL1Error +
              centerError * 2 +
              edgeError * 2 +
              evError * 0.5 +
              metrics.stuckRate * 20,
            pocketFrequencies: metrics.pocketFrequencies,
          });
        }
      }
    }
  }
}

candidates.sort((left, right) => left.score - right.score);
process.stdout.write(JSON.stringify(candidates.slice(0, 20), null, 2) + '\n');
