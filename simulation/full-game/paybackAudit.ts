import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execSync} from 'node:child_process';
import {parseBalanceConfig} from '../../src/config/balance';
import {createInitialGameState, type GameState} from '../../src/core/state/GameState';
import {SeededRandom} from '../../src/core/rng/SeededRandom';
import {buildCasinoUpgradePreviews,type CasinoUpgradeId} from '../../src/game/casino/casinoUiModel';
import {purchasePocketUpgrade,purchaseSpecialUpgrade,purchaseMaxBetUpgrade,getMaxBetForLevel} from '../../src/core/plinko-rules/progression';
import {createSharedWorld} from './sharedWorld';
const runnerHash=createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex');
const raw=readFileSync(process.argv[2]??'balance.v0.json','utf8'),config=parseBalanceConfig(JSON.parse(raw));
const output=process.argv[3]!,count=Number(process.argv[4]??200),seed=Number(process.argv[5]??67116000);
if(!output || !Number.isInteger(count)||count<2)throw Error('output and sample count required');
mkdirSync(output,{recursive:true});
const rng=new SeededRandom(seed),seeds=Array.from({length:count},()=>{rng.next();return rng.snapshot().state});
const fields=['plinkoCenterLevel','plinkoMidLevel','plinkoJackpotLevel','plinkoAmplifierLevel','plinkoReturnLevel','plinkoSplitterLevel','plinkoJackpotBiasLevel'] as const;
const levels=(s:GameState)=>Object.fromEntries([...fields,'plinkoMaxBetLevel' as const].map(k=>[k,s[k]]));
const samples:Record<string,{mean:number;seconds:number;values:number[]}>= {};
function measure(s:GameState){
 const key=fields.map(k=>s[k]).join('/');if(samples[key])return samples[key];
 const values:number[]=[];let ticks=0;
 for(const root of seeds){const w=createSharedWorld({...s,cash:1e9,plinkoMaxBetLevel:0,rngState:root},config);
 try{if(!w.launch(1))throw Error('launch');let t=0;while(w.active&&t<3600){w.step();t++;}if(w.active)throw Error('unresolved');const r=w.snapshot().settlements[0]!;values.push(r.payout/r.stake);ticks+=t;}finally{w.destroy();}}
 return samples[key]={mean:values.reduce((a,b)=>a+b,0)/count,seconds:ticks/count/60,values};
}
function buy(s:GameState,id:CasinoUpgradeId){return id==='maxBet'?purchaseMaxBetUpgrade(s,null,config):id==='center'||id==='mid'||id==='jackpot'?purchasePocketUpgrade(s,null,config,id):purchaseSpecialUpgrade(s,null,config,id as 'amplifier'|'return'|'splitter'|'jackpotBias');}
let state={...createInitialGameState(config,seed),cash:1e9};const stages:any[]=[];
const fixed=process.argv[6]?JSON.parse(readFileSync(process.argv[6],'utf8')).stages.map((s:any)=>s.chosen.id) as CasinoUpgradeId[]:null;
while(true){const base=measure(state),cap=getMaxBetForLevel(config,state.plinkoMaxBetLevel),baseRate=(base.mean-1)*cap*0.5/base.seconds;
 const options=buildCasinoUpgradePreviews(state,null,config).filter(p=>!p.maxed&&p.id!=='insurance'&&p.id!=='capacity');if(!options.length)break;
 const se=Math.sqrt(base.values.reduce((s,v)=>s+(v-base.mean)**2,0)/(count-1)/count);
 const activeOptions=fixed?options.filter(p=>p.id===fixed[stages.length]):options;
 const candidates=activeOptions.map(p=>{const next=buy(state,p.id),m=measure(next),rate=(m.mean-1)*getMaxBetForLevel(config,next.plinkoMaxBetLevel)*0.5/m.seconds,delta=rate-baseRate;return {id:p.id,level:p.currentLevel+1,price:p.nextPrice!,mean:m.mean,seconds:m.seconds,deltaRate:delta,score:p.id==='maxBet'&&base.mean-1<=1.96*se?-1e30:delta/p.nextPrice!,paybackSeconds:delta>0?p.nextPrice!/delta:null};}).sort((a,b)=>b.score-a.score);
 const chosen=fixed?candidates.find(c=>c.id===fixed[stages.length])!:candidates[0]!;if(!chosen)throw Error('fixed path incomplete');
 stages.push({levels:levels(state),baseMean:base.mean,baseSeconds:base.seconds,baseRate,baseMeanStandardError:se,chosen,candidates});
 state=buy(state,chosen.id);console.log(stages.length,chosen.id,chosen.level,chosen.price,chosen.paybackSeconds?.toFixed(1),base.mean.toFixed(2),'=>',chosen.mean.toFixed(2));
 writeFileSync(output+'/summary.json',JSON.stringify({metadata:{revision:execSync('git rev-parse HEAD').toString().trim(),configHash:createHash('sha256').update(raw).digest('hex'),runnerHash,count,seed,fixedPath:process.argv[6]??null,model:'paired independent roots; expected net income per solo-board second at half cap; greedy one-step marginal gain/price, not globally optimal; selection noise; cap ranking deferred until mean gross return lower normal 95% bound exceeds 1; no bankroll, insurance or need costs in ranking'},stages},null,2));
 writeFileSync(output+'/samples.json.gz',gzipSync(JSON.stringify(samples)));
}
