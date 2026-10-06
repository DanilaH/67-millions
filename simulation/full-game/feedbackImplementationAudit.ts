import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { parseBalanceConfig } from '../../src/config/balance';
import { createInitialGameState } from '../../src/core/state/GameState';
import { SeededRandom } from '../../src/core/rng/SeededRandom';
import { createSharedWorld } from './sharedWorld';
const raw = readFileSync(process.argv[2]!, 'utf8'), config = parseBalanceConfig(JSON.parse(raw));
const output = process.argv[3]!, count = Number(process.argv[4] ?? 1000), seed = Number(process.argv[5] ?? 67110610);
const rng = new SeededRandom(seed), seeds = Array.from({length:count},()=>{rng.next();return rng.snapshot().state;});
const contexts = {
  bare: {},
  early: {plinkoAmplifierLevel:1,plinkoSplitterLevel:1,plinkoJackpotBiasLevel:1},
  middle: {plinkoCenterLevel:1,plinkoMidLevel:2,plinkoJackpotLevel:1,plinkoAmplifierLevel:3,plinkoSplitterLevel:3,plinkoJackpotBiasLevel:2},
  max: {plinkoCenterLevel:2,plinkoMidLevel:3,plinkoJackpotLevel:3,plinkoAmplifierLevel:5,plinkoSplitterLevel:5,plinkoJackpotBiasLevel:4},
};
const hash = (s:string)=>createHash('sha256').update(s).digest('hex');
const metadata = {revision:execSync('git rev-parse HEAD').toString().trim(),configHash:hash(raw),runnerHash:hash(readFileSync(import.meta.filename,'utf8')),worldHash:hash(readFileSync('simulation/full-game/sharedWorld.ts','utf8')),returnPhysicsHash:hash(readFileSync('src/core/plinko-rules/returnPhysics.ts','utf8')),count,seed,contexts,model:'production Phaser shared world; independent roots; 3600 tick cap; gross payout/stake'};
const rows:any[]=[];
for (const [context, levels] of Object.entries(contexts)) for(const level of [0,1,2,3,4]) {
  const values:(number|null)[]=[];let unresolved=0,edges=0,returns=0,bonuses=0;
  for(const rootSeed of seeds) {
    const world=createSharedWorld({...createInitialGameState(config,rootSeed),cash:10000000,...levels,plinkoReturnLevel:level},config);
    try {
      if(!world.launch(1))throw Error('Launch refused');
      for(let t=0;world.active&&t<3600;t++)world.step();
      if(world.active){unresolved++;values.push(null);continue;}
      const s=world.snapshot(),paid=s.settlements[0]!;values.push(paid.payout/paid.stake);
      if(s.diagnostics.pockets[0]!+s.diagnostics.pockets[9]!>0)edges++;
      if(s.diagnostics.returnProcs)returns++;
      bonuses+=s.diagnostics.returnedBranchesWithLaterBonus;
    } finally {world.destroy();}
  }
  const resolved=values.filter((v):v is number=>v!==null);
  const mean=resolved.reduce((a,b)=>a+b,0)/resolved.length;
  const row={context,level,mean,edge:edges/count,returnRate:returns/count,branchBonus:returns?bonuses/returns:null,unresolved,values};rows.push(row);
  console.log(JSON.stringify({...row,values:undefined}));
  writeFileSync(output+'.json',JSON.stringify({metadata,rows:rows.map(({values,...r})=>r)},null,2));
  writeFileSync(output+'.json.gz',gzipSync(JSON.stringify({metadata,rows})));
}
