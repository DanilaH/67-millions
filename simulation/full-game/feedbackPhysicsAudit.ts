import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { parseBalanceConfig } from '../../src/config/balance';
import { createInitialGameState } from '../../src/core/state/GameState';
import { SeededRandom } from '../../src/core/rng/SeededRandom';
import { createSharedWorld } from './sharedWorld';

type Candidate = { name: string; retention?: number; lower?: number; central?: boolean; returnLevel?: number; biasLevel?: number };
const candidates: Candidate[] = JSON.parse(readFileSync(process.argv[2]!, 'utf8'));
const count = Number(process.argv[3] ?? 500), seed = Number(process.argv[4] ?? 67110601), output = process.argv[5]!;
const raw = readFileSync(process.argv[6] ?? 'balance.v0.json', 'utf8');
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const rng = new SeededRandom(seed);
const seeds = Array.from({length: count}, () => { rng.next(); return rng.snapshot().state; });
const rows: object[] = [];
const provenance = { revision: execSync('git rev-parse HEAD').toString().trim(), sourceConfigHash: hash(raw), scriptHash: hash(readFileSync(import.meta.filename, 'utf8')), sharedWorldHash: hash(readFileSync('simulation/full-game/sharedWorld.ts','utf8')), count, seed, model: 'Phaser shared-world, independent paid roots, 3600 tick limit, common seed stream; gross payout/stake, not human pacing', candidates };
for (const c of candidates) for (const context of ['isolated', 'combined'] as const) {
  const source = JSON.parse(raw);
  if (c.retention !== undefined) {
    source.plinko.returnPhysics.horizontalRetention = c.retention;
    delete source.plinko.returnPhysics.horizontalRetentionByLevel;
  }
  if (c.lower !== undefined) for (const level of source.plinko.jackpotBias) for (const pair of level.deflectorPairs) pair.deflectorY += c.lower;
  if (c.central) {
    const pairs = [['r8c3','r8c5'], ['r7c3','r7c4'], ['r6c2','r6c4'], ['r5c2','r5c3']];
    source.plinko.specialPinLayout.returnByLevel.forEach((l: {pegIds:string[]}, i:number) => l.pegIds = pairs[i]!);
  }
  const config = parseBalanceConfig(source);
  const values: (number|null)[] = [];
  let unresolved = 0, edges = 0, returns = 0, laterBonus = 0, branchBonus = 0, ticksTotal = 0;
  for (const rootSeed of seeds) {
    const state = {...createInitialGameState(config, rootSeed), cash: 10000000,
      ...(context === 'combined' ? {plinkoCenterLevel:2,plinkoMidLevel:3,plinkoJackpotLevel:3,plinkoAmplifierLevel:5,plinkoSplitterLevel:5,plinkoReturnLevel:4,plinkoJackpotBiasLevel:4} : {}),
      ...(c.returnLevel !== undefined ? {plinkoReturnLevel:c.returnLevel} : {}),
      ...(c.biasLevel !== undefined ? {plinkoJackpotBiasLevel:c.biasLevel} : {}),
    };
    const world = createSharedWorld(state, config);
    try {
      if (!world.launch(1)) throw Error('Launch refused');
      let ticks = 0; while(world.active && ticks < 3600) { world.step(); ticks++; }
      ticksTotal += ticks;
      if(world.active) { unresolved++; values.push(null); continue; }
      const s = world.snapshot(), settlement = s.settlements[0]!;
      values.push(settlement.payout/settlement.stake);
      if(s.diagnostics.pockets[0]! + s.diagnostics.pockets[9]! > 0) edges++;
      if(s.diagnostics.returnProcs) returns++;
      laterBonus += s.diagnostics.returnedLineagesWithLaterBonus;
      branchBonus += s.diagnostics.returnedBranchesWithLaterBonus;
    } finally { world.destroy(); }
  }
  const resolved = values.filter((v):v is number => v !== null);
  const mean = resolved.reduce((a,b)=>a+b,0)/resolved.length;
  const row = {candidate:c.name,context,configHash:hash(JSON.stringify(source)),mean,se:Math.sqrt(resolved.reduce((s,v)=>s+(v-mean)**2,0)/(resolved.length-1)/resolved.length),edge:edges/count,returnRate:returns/count,bonusAfterReturn:returns?laterBonus/returns:null,branchBonusAfterReturn:returns?branchBonus/returns:null,meanTicks:ticksTotal/count,unresolved,values};
  rows.push(row); console.log(JSON.stringify({...row,values:undefined}));
  writeFileSync(output+'.json',JSON.stringify({...provenance,rows:rows.map(({values,...r}:any)=>r)},null,2));
  writeFileSync(output+'.json.gz',gzipSync(JSON.stringify({...provenance,rows})));
}
