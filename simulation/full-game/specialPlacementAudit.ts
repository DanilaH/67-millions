import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execSync} from 'node:child_process';
import {parseBalanceConfig} from '../../src/config/balance';
import {createInitialGameState,type GameState} from '../../src/core/state/GameState';
import {SeededRandom} from '../../src/core/rng/SeededRandom';
import {createSharedWorld} from './sharedWorld';
const raw=readFileSync(process.argv[6]??'balance.v0.json','utf8');
const base=JSON.parse(raw);
type Candidate={name:string;returnPins?:[string,string];splitterPin?:string;returnLevel?:number;splitterLevel?:number;childValue?:number};
const candidates=JSON.parse(readFileSync(process.argv[2]!,'utf8')) as Candidate[];
const count=Number(process.argv[3]??500),seed=Number(process.argv[4]??67108000);
if(!Number.isInteger(count)||count<1||!Number.isInteger(seed)||seed<1||seed>0xffffffff)throw Error('Expected positive count and nonzero uint32 seed');
const rng=new SeededRandom(seed);const seeds=Array.from({length:count},()=>{rng.next();return rng.snapshot().state;});
const rows=[];
for(const candidate of candidates)for(const context of ['isolated','combined'] as const){
 const source=structuredClone(base);
 if(candidate.splitterPin)source.plinko.specialPinLayout.splitterPegIds=[candidate.splitterPin];
 if(candidate.returnPins){
  // Only L4 is active in the placement probe; keep inactive pairs disjoint so
  // every experimental config still passes production validation.
  const used=new Set([...source.plinko.specialPinLayout.amplifierByCount['3'],...source.plinko.specialPinLayout.splitterPegIds,...candidate.returnPins]);
  for(const l of source.plinko.specialPinLayout.returnByLevel){
   if(l.level===4){l.pegIds=candidate.returnPins;continue;}
   let found=false;
   for(let r=3;r<9&&!found;r++)for(let c=0;c<(r+1)/2&&!found;c++){
    const pair=[`r${r}c${c}`,`r${r}c${r-c}`];
    if(pair[0]!==pair[1]&&pair.every(p=>!used.has(p))){l.pegIds=pair;pair.forEach(p=>used.add(p));found=true;}
   }
  }
 }
 if(candidate.childValue)source.plinko.splitter.forEach((l:{childValue:number})=>{l.childValue=candidate.childValue!;});
 const config=parseBalanceConfig(source);
 const levels:Partial<GameState>=context==='combined'?{plinkoCenterLevel:2,plinkoMidLevel:3,plinkoJackpotLevel:3,plinkoAmplifierLevel:5,plinkoReturnLevel:4,plinkoSplitterLevel:5,plinkoJackpotBiasLevel:4}:{};
 levels.plinkoReturnLevel=candidate.returnLevel??(candidate.returnPins?4:context==='combined'?4:0);
 levels.plinkoSplitterLevel=candidate.splitterLevel??(context==='combined'?5:candidate.splitterPin&&!candidate.returnPins?5:0);
 const values:number[]=[];let procs=0,edges=0,failed=0;
 for(const seed of seeds){const w=createSharedWorld({...createInitialGameState(config,seed),cash:100000,...levels},config);
  try{w.launch(1);let ticks=0;while(w.active&&ticks<3600){w.step();ticks++;}if(w.active){failed++;continue;}
   const s=w.snapshot(),v=s.settlements[0]!;values.push(v.payout/v.stake);if(s.diagnostics.returnProcs||s.diagnostics.splitterProcs)procs++;if(s.diagnostics.pockets[0]!+s.diagnostics.pockets[9]!>0)edges++;
  }finally{w.destroy();}}
 const mean=values.reduce((a,b)=>a+b,0)/values.length;
 const row={candidate,context,count,failed,mean,se:Math.sqrt(values.reduce((s,v)=>s+(v-mean)**2,0)/(values.length-1)/values.length),edge:edges/count,proc:procs/count,values};rows.push(row);
 console.log(JSON.stringify({...row,values:undefined}));
 writeFileSync(process.argv[5]??'/tmp/special-placement.json',JSON.stringify({sourceRevision:execSync('git rev-parse HEAD').toString().trim(),model:'Phaser CustomMain + Phaser Resolver initialization; independent roots; xorshift seed stream; paired contexts',configHash:createHash('sha256').update(raw).digest('hex'),seed,count,candidates,rows}));
}
