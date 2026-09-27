import { balance } from '../../src/config/balance';
import { summarizePhysicalDrops } from './metrics';
import { runBarePhysicalDrops } from './physicalRunner';

const IDEAL = [1, 9, 36, 84, 126, 126, 84, 36, 9, 1].map((value) => value / 512);
const TARGET_EV = 0.849609375;

interface CandidateResult {
  horizontalSpacing: number;
  verticalSpacing: number;
  ballRestitution: number;
  pegRestitution: number;
  ev: number;
  stuckRate: number;
  shapeError: number;
  score: number;
  frequencies: number[];
}

const results: CandidateResult[] = [];
let candidateIndex = 0;

for (const horizontalSpacing of [40, 44, 48]) {
  for (const verticalSpacing of [28, 34, 42]) {
    for (const ballRestitution of [0.2, 0.35, 0.52]) {
      for (const pegRestitution of [0.3, 0.45, 0.6]) {
        const config = structuredClone(balance);
        config.plinko.geometry.horizontalPegSpacing = horizontalSpacing;
        config.plinko.geometry.pocketCenterSpacing = horizontalSpacing;
        config.plinko.geometry.verticalPegSpacing = verticalSpacing;
        config.plinko.physicsSeed.ballRestitution = ballRestitution;
        config.plinko.physicsSeed.pegRestitution = pegRestitution;

        const samples = runBarePhysicalDrops(config, {
          runs: 1000,
          seed: 67_000_000 + candidateIndex * 10_007,
          batchSize: 128,
        });
        candidateIndex += 1;

        const metrics = summarizePhysicalDrops(config, samples);
        const shapeError = metrics.pocketFrequencies.reduce(
          (sum, frequency, index) => sum + Math.abs(frequency - (IDEAL[index] ?? 0)),
          0,
        );
        const evError = Math.abs(metrics.ev - TARGET_EV);
        const score = shapeError + evError * 0.35 + metrics.stuckRate * 10;

        results.push({
          horizontalSpacing,
          verticalSpacing,
          ballRestitution,
          pegRestitution,
          ev: metrics.ev,
          stuckRate: metrics.stuckRate,
          shapeError,
          score,
          frequencies: metrics.pocketFrequencies,
        });
      }
    }
  }
}

results.sort((left, right) => left.score - right.score);
process.stdout.write(JSON.stringify(results.slice(0, 12), null, 2) + '\n');
