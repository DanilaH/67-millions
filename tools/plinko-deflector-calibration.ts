import { balance } from '../src/config/balance';
import legacyPairs from '../src/config/plinko-deflectors-2026-10-02.json';
import { runBarePhysicalDrops } from '../simulation/plinko/physicalRunner';
import { runCascadePhysicalDrops } from '../simulation/plinko/cascadeRunner';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const runs = Number(process.env.RUNS ?? 5000), seed = 67043101;
const mode = process.argv[2] ?? 'position';
const values: Record<string, number[]> = { restitution: [0.75, 0.6, 0.45, 0.3, 0.155], length: [36, 32, 28, 24], angle: [15, 20, 30, 35], offset: [2, 4, 6, 8, 12], position: [8, 12, 16] };
if (!values[mode]) throw new Error('Expected restitution, length, angle, offset or position');
const results = [];
for (const value of values[mode]!) for (const topOffset of mode === 'position' ? [110, 110.5, 111, 111.5] : [110]) {
  const config = structuredClone(balance);
  config.plinko.jackpotBias.forEach((level, index) => {
    level.deflectorPairs = structuredClone(legacyPairs[index]!);
    level.deflectorPairs.forEach((pair, i) => {
      if (mode === 'restitution') pair.restitution = value;
      if (mode === 'length') pair.length = value;
      if (mode === 'angle') pair.angleDegrees = value;
      if (mode === 'offset') pair.deflectorOffsetX += value;
      if (mode === 'position') pair.deflectorOffsetX = i === 3 ? topOffset : pair.deflectorOffsetX + value;
    });
  });
  const levels = [];
  for (const level of mode === 'position' && topOffset !== 110 ? [4] : [0, 1, 2, 3, 4]) {
    const samples = runBarePhysicalDrops(config, { runs, seed, batchSize: 256, jackpotBiasLevel: level });
    levels.push({ level, edge: samples.filter(s => s.pocketIndex === 0 || s.pocketIndex === 9).length / runs, stuck: samples.filter(s => s.stuck).length });
  }
  const samples = mode === 'position' ? [] : runCascadePhysicalDrops(config, { runs, seed, batchSize: 64, pocketMultipliers: config.plinko.basePockets, specialLevels: { amplifierLevel: 5, returnLevel: 4, splitterLevel: 5, jackpotBiasLevel: 4 } });
  const row = { mode, value, topOffset, configHash: createHash('sha256').update(JSON.stringify(config)).digest('hex'), levels, maxDropEdge: samples.length ? samples.filter(s => s.pocketCounts[0]! + s.pocketCounts[9]! > 0).length / runs : null, stuck: samples.filter(s => s.stuck).length };
  results.push(row); console.log(JSON.stringify(row));
}
writeFileSync(`reports/physics/2026-10-03/probe-${mode}.json`, JSON.stringify({ runs, seed, results }, null, 2) + '\n');
