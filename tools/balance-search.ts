import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseBalanceConfig} from '../src/config/balance';
import {createBaselinePolicy,BASELINE_ARCHETYPES} from '../simulation/full-game/policies';
import {createHighVariancePolicy,HIGH_VARIANCE_ARCHETYPES} from '../simulation/full-game/highVariancePolicies';
import {createEvidenceDerivedPlinkoModel} from '../simulation/full-game/evidencePlinkoModel';
import {createPhysicalPlinkoModel} from '../simulation/full-game/physicalPlinkoModel';
import {runFullGame} from '../simulation/full-game/runner';
const raw=JSON.parse(readFileSync('balance.v0.json','utf8'));
const output=process.env.BALANCE_SEARCH_OUTPUT ?? '/workspace/67m-evidence/search';mkdirSync(output,{recursive:true});
const physical=process.argv.includes('--physical');const runs=Number(process.env.BALANCE_SEARCH_RUNS ?? 100);
const model=physical?createPhysicalPlinkoModel():createEvidenceDerivedPlinkoModel();
const summaries=[];
for(const priceScale of [1,0.5,0.25,0.1]){
 for(const payoutScale of [1,1.5,2]){
  const candidate=structuredClone(raw);
  candidate.meta.version=`0.8-candidate-price${priceScale}-payout${payoutScale}`;
  for(const track of ['centerUpgrades','midUpgrades','jackpotUpgrades','amplifier','return','splitter','jackpotBias','insurance']){
   for(const level of candidate.plinko[track])if(level.price>0)level.price=Math.max(1,Math.round(level.price*priceScale));
  }
  for(const job of Object.values(candidate.work.jobs) as {levels:{payout:number;upgradePrice:number}[]}[]){
   for(const level of job.levels){level.payout=Math.round(level.payout*payoutScale);if(level.upgradePrice>0)level.upgradePrice=Math.round(level.upgradePrice*priceScale);}
  }
  const config=parseBalanceConfig(candidate);const configText=JSON.stringify(candidate,null,2)+'\n';
  const hash=createHash('sha256').update(configText).digest('hex');
  const summary={priceScale,payoutScale,model:model.id,configHash:hash,seedStart:67071000,runsPerPolicy:runs,strategies:[] as unknown[]};
  for(const archetype of [...BASELINE_ARCHETYPES,...HIGH_VARIANCE_ARCHETYPES]){
   const results=[];
   for(let i=0;i<runs;i++){
    const seed=67071000+i;const policy=archetype==='DEGENERATE'||archetype==='RECKLESS_NEEDS'?createHighVariancePolicy(config,archetype,seed):createBaselinePolicy(config,archetype,seed);
    results.push(runFullGame(config,policy,model,{seed,configHash:hash,maxDecisions:20000,maxGameMinutes:35*1440}));
   }
   const wins=results.filter(r=>r.outcome==='VICTORY');
   const mean=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
   const metrics={archetype,wins:wins.length,winRate:wins.length/runs,averageWorks:mean(results.map(r=>r.counters.workShifts)),winAverageWorks:mean(wins.map(r=>r.counters.workShifts)),winAverageDrops:mean(wins.map(r=>r.counters.plinkoDrops)),barryLoss:results.filter(r=>r.outcome==='BARRY_LOSS').length,hpDeath:results.filter(r=>r.outcome==='HP_DEATH').length};
   summary.strategies.push(metrics);
  }
  const name=`price${priceScale}-payout${payoutScale}`;writeFileSync(`${output}/${name}.json`,configText);writeFileSync(`${output}/${name}-${physical?'physical':'evidence'}.json`,JSON.stringify(summary,null,2));summaries.push(summary);console.log(JSON.stringify(summary));
 }
}
writeFileSync(`${output}/summary-${physical?'physical':'evidence'}.json`,JSON.stringify(summaries,null,2));
