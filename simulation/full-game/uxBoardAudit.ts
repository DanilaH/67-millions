import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseBalanceConfig } from '../../src/config/balance';
import { derivePocketMultipliers } from '../../src/core/plinko-rules/progression';
import { runCascadePhysicalDrops } from '../plinko/cascadeRunner';
const raw = readFileSync('balance.v0.json', 'utf8');
const config = parseBalanceConfig(JSON.parse(raw));
const rows = [];
for (const stage of ['base', 'pockets-max', 'all-max'] as const) {
  const specialLevels = {
    amplifierLevel: stage === 'all-max' ? config.plinko.amplifier.at(-1)!.level : 0,
    returnLevel: stage === 'all-max' ? config.plinko.return.at(-1)!.level : 0,
    splitterLevel: stage === 'all-max' ? config.plinko.splitter.at(-1)!.level : 0,
    jackpotBiasLevel: stage === 'all-max' ? config.plinko.jackpotBias.at(-1)!.level : 0,
  };
  const pocketLevels = { centerLevel: stage === 'base' ? 0 : config.plinko.centerUpgrades.at(-1)!.level, midLevel: stage === 'base' ? 0 : config.plinko.midUpgrades.at(-1)!.level, jackpotLevel: stage === 'base' ? 0 : config.plinko.jackpotUpgrades.at(-1)!.level };
  const samples = runCascadePhysicalDrops(config, { runs: 5000, batchSize: 1, seed: 67105000, stake: 1000, specialLevels, pocketMultipliers: derivePocketMultipliers(config, pocketLevels) });
  const sorted = samples.map(s => s.aggregateMultiplier).sort((a,b)=>a-b);
  const durations = samples.map(s=>s.ticks/config.plinko.geometry.fixedTimestepHz).sort((a,b)=>a-b);
  rows.push({ stage, specialLevels, pocketLevels, runs: samples.length, stuck: samples.filter(s=>s.stuck).length, meanMultiplier: sorted.reduce((a,b)=>a+b,0)/sorted.length, medianMultiplier: sorted[2500], lossShare: sorted.filter(x=>x<1).length/sorted.length, topOnePercentPayoutShare: sorted.slice(-50).reduce((a,b)=>a+b,0)/sorted.reduce((a,b)=>a+b,0), medianSeconds: durations[2500], p95Seconds: durations[4750] });
  process.stderr.write(`${stage} done\n`);
}
writeFileSync('reports/pacing/2026-10-04/boards.json', JSON.stringify({ configHash: createHash('sha256').update(raw).digest('hex'), seed: 67105000, model: 'canonical Matter cascade; 5000 single-root runs per stage, no insurance', rows },null,2));
