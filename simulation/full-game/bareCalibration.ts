import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { parseBalanceConfig } from '../../src/config/balance';
import { createInitialGameState } from '../../src/core/state/GameState';
import { SeededRandom } from '../../src/core/rng/SeededRandom';
import { createSharedWorld } from './sharedWorld';
const source=JSON.parse(readFileSync('balance.v0.json','utf8'));
const candidates=JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as {name:string; physics?:Record<string,number>; geometry?:Record<string,number>}[];
const count=Number(process.argv[3]??500), seed=Number(process.argv[4]??67107100);
if (!Number.isInteger(count) || count < 1 || !Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) throw Error('Expected positive count and nonzero uint32 seed');
const rng=new SeededRandom(seed);
const seeds=Array.from({length:count},()=>{rng.next();return rng.snapshot().state;});
const rows=[];
for(const candidate of candidates){
 const raw=structuredClone(source);Object.assign(raw.plinko.physicsSeed,candidate.physics);Object.assign(raw.plinko.geometry,candidate.geometry);
 const config=parseBalanceConfig(raw), pockets=Array<number>(10).fill(0);let sum=0,sum2=0,failed=0,ticksTotal=0;
 for(const rootSeed of seeds){
  const world=createSharedWorld({...createInitialGameState(config,rootSeed),cash:100000},config);
  try{world.launch(1);let ticks=0;while(world.active&&ticks<3600){world.step();ticks++;}ticksTotal+=ticks;
   if(world.active){failed++;continue;}
   const result=world.snapshot();const v=result.settlements[0]!.payout/result.settlements[0]!.stake;sum+=v;sum2+=v*v;
   result.diagnostics.pockets.forEach((n,i)=>{pockets[i]!+=n;});
  }finally{world.destroy();}
 }
 const mean=sum/(count-failed);
 const row={...candidate,count,failed,mean,se:Math.sqrt(Math.max(0,sum2/(count-failed)-mean*mean)/(count-failed)),edge:(pockets[0]!+pockets[9]!)/count,center:(pockets[4]!+pockets[5]!)/count,pockets,meanSeconds:ticksTotal/count/60,configHash:createHash('sha256').update(JSON.stringify(raw)).digest('hex')};rows.push(row);console.log(JSON.stringify(row));
 writeFileSync(process.argv[5]??'/tmp/bare-calibration.json',JSON.stringify({revision:execSync('git rev-parse HEAD').toString().trim(),seed,count,rows},null,2));
}
