import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { parseBalanceConfig } from '../../src/config/balance';
import { createInitialGameState } from '../../src/core/state/GameState';
import { SeededRandom } from '../../src/core/rng/SeededRandom';
import { createSharedWorld } from './sharedWorld';
const raw=readFileSync('balance.v0.json','utf8'), config=parseBalanceConfig(JSON.parse(raw));
const count=Number(process.argv[2]??200), output=process.argv[3]??'reports/pacing/2026-10-06-concurrency';
if(!Number.isInteger(count)||count<1)throw Error('Invalid count');
const seed=67122000,rng=new SeededRandom(seed),seeds=Array.from({length:count},()=>{rng.next();return rng.snapshot().state;});
const max={plinkoCenterLevel:2,plinkoMidLevel:3,plinkoJackpotLevel:3,plinkoAmplifierLevel:5,plinkoSplitterLevel:5,plinkoJackpotBiasLevel:4,plinkoReturnLevel:4};
const baseContexts={bare:{},early:{plinkoCenterLevel:1,plinkoAmplifierLevel:1,plinkoSplitterLevel:1,plinkoJackpotBiasLevel:1,plinkoReturnLevel:1},max,
 noReturn:{...max,plinkoReturnLevel:0},noAmplifier:{...max,plinkoAmplifierLevel:0},noSplitter:{...max,plinkoSplitterLevel:0},noGuides:{...max,plinkoJackpotBiasLevel:0}};
const contexts=process.env.AUDIT_ADJACENT ? {max,...Object.fromEntries(Object.entries(max).map(([key,value])=>['minusOne-'+key,{...max,[key]:value-1}]))} : baseContexts;
const batches=process.env.AUDIT_BATCHES ? process.env.AUDIT_BATCHES.split(',').map(Number):[1,2,3,6];
if(batches.some(n=>!Number.isInteger(n)||n<1||n>6))throw Error('Invalid batches');
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const metadata={revision:execSync('git rev-parse HEAD').toString().trim(),configHash:hash(raw),runnerHash:hash(readFileSync(import.meta.filename,'utf8')),count,seed,contexts,batches,launchSpacingTicks:15,model:'production shared-world; bounded burst then drain; fixed base stake; no purchases/insurance',limitations:'Paired session seeds, not matched root trajectories across batch sizes. Generous bankroll isolates throughput. No full-game or human win prediction. 2s decision overhead shown separately.'};
const rows:any[]=[],samples:any[]=[];
mkdirSync(output,{recursive:true});
for(const [context,levels] of Object.entries(contexts))for(const batch of batches){
 let stakes=0,payouts=0,seconds=0,splitter=0,returns=0,amplifier=0,maxBalls=0;
 const values:number[]=[];
 for(const s of seeds){
  const world=createSharedWorld({...createInitialGameState(config,s),cash:10000000,...levels},config);
  try{
   let ticks=0;
   for(let i=0;i<batch;i++){
    if(!world.launch(1))throw Error('launch refused');
    for(let t=0;t<15;t++){world.step();ticks++;maxBalls=Math.max(maxBalls,world.observe().liveBalls);}
   }
   while(world.active&&ticks<3600){world.step();ticks++;maxBalls=Math.max(maxBalls,world.observe().liveBalls);}
   if(world.active)throw Error('unresolved');
   const snap=world.snapshot(),stake=snap.settlements.reduce((a,b)=>a+b.stake,0),payout=snap.settlements.reduce((a,b)=>a+b.payout,0);
   stakes+=stake;payouts+=payout;seconds+=ticks/60;splitter+=snap.diagnostics.splitterProcs;returns+=snap.diagnostics.returnProcs;amplifier+=snap.diagnostics.amplifierProcs;
   values.push(payout/stake);samples.push({context,batch,seed:s,stake,payout,ticks});
  }finally{world.destroy();}
 }
 const mean=payouts/stakes;
 const row={context,batch,gross:mean,standardError:count>1?Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/(count-1)/count):null,meanSeconds:seconds/count,netPerSecond:(payouts-stakes)/seconds,netPerSecondWithDecision:(payouts-stakes)/(seconds+count*2),splitterPerRoot:splitter/(batch*count),returnsPerRoot:returns/(batch*count),amplifierPerRoot:amplifier/(batch*count),maxBalls};
 rows.push(row);console.log(JSON.stringify(row));
 writeFileSync(output+'/summary.json',JSON.stringify({metadata,rows},null,2));
}
writeFileSync(output+'/samples.json.gz',gzipSync(JSON.stringify(samples)));
