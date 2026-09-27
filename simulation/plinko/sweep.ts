import { balance } from '../../src/config/balance';
import { summarizePhysicalDrops } from './metrics';
import { runBarePhysicalDrops } from './physicalRunner';

interface Candidate {
  verticalSpacing: number;
  ballRestitution: number;
  pegRestitution: number;
  frictionAir: number;
  gravityY: number;
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

for (const verticalSpacing of [27, 28, 29, 30, 31]) {
  for (const ballRestitution of [0.08, 0.12, 0.16, 0.2]) {
    for (const pegRestitution of [0.5, 0.55, 0.6, 0.65]) {
      for (const frictionAir of [0.018, 0.022, 0.026, 0.03]) {
        for (const gravityY of [0.8, 1, 1.2]) {
          const config = structuredClone(balance);
          config.plinko.geometry.horizontalPegSpacing = 48;
          config.plinko.geometry.pocketCenterSpacing = 48;
          config.plinko.geometry.verticalPegSpacing = verticalSpacing;
          config.plinko.physicsSeed.ballRestitution = ballRestitution;
          config.plinko.physicsSeed.pegRestitution = pegRestitution;
          config.plinko.physicsSeed.frictionAir = frictionAir;
          config.plinko.physicsSeed.gravityY = gravityY;

          const samples = runBarePhysicalDrops(config, {
            runs: 400,
            seed: 67_000_000 + index * 7_919,
            batchSize: 100,
            maxTicks: config.plinko.geometry.fixedTimestepHz * 12,
          });
          index += 1;

          const metrics = summarizePhysicalDrops(config, samples);
          const centerTarget = 0.495;
          const centerError = Math.abs(metrics.combinedCenterProbability - centerTarget);
          const evError = Math.abs(metrics.ev - config.plinko.targetBareEV);
          const edgeError = Math.max(0, metrics.edgePocketProbability - 0.02);

          candidates.push({
            verticalSpacing,
            ballRestitution,
            pegRestitution,
            frictionAir,
            gravityY,
            ev: metrics.ev,
            combinedCenterProbability: metrics.combinedCenterProbability,
            edgePocketProbability: metrics.edgePocketProbability,
            stuckRate: metrics.stuckRate,
            galtonShapeL1Error: metrics.galtonShapeL1Error,
            score:
              centerError * 4 +
              evError * 1.25 +
              metrics.galtonShapeL1Error +
              edgeError * 4 +
              metrics.stuckRate * 30,
            pocketFrequencies: metrics.pocketFrequencies,
          });
        }
      }
    }
  }
}

candidates.sort((left, right) => left.score - right.score);
process.stdout.write(JSON.stringify(candidates.slice(0, 25), null, 2) + '\n');
