import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { parseBalanceConfig } from '../../src/config/balance';
import { buildCasinoUpgradePreviews, type CasinoUpgradeId } from '../../src/game/casino/casinoUiModel';
import { createLiquidityPolicy } from './liquidityPolicy';
import { runFullGame, type FullGameDecision } from './runner';
import { createSharedWorld } from './sharedWorld';
const raw = readFileSync(process.argv[5]??'balance.v0.json','utf8');
const config = parseBalanceConfig(JSON.parse(raw));
const configHash = createHash('sha256').update(raw).digest('hex');
const perVariant = Number(process.argv[2] ?? 20);
const output = process.argv[3] ?? 'reports/pacing/2026-10-05';
const decisionDelay = Number(process.argv[4] ?? 2);
const seedStart = Number(process.argv[6] ?? 67104000);
const archetype = process.argv[7] ?? 'BASELINE_GROWTH';
if (archetype !== 'BASELINE_GROWTH' && archetype !== 'AGGRESSIVE') throw Error('Unsupported audit archetype');
if (!Number.isInteger(seedStart) || seedStart < 1 || seedStart > 0xffffffff - perVariant) throw Error('Invalid seed range');
const runs = [];
const buy = (id: CasinoUpgradeId): FullGameDecision => id === 'maxBet' ? { type: 'BUY_PLINKO_MAX_BET' } : id === 'insurance' ? {type:'BUY_PLINKO_INSURANCE'} : ['center','mid','jackpot'].includes(id) ? {type:'BUY_PLINKO_POCKET',track:id as 'center'|'mid'|'jackpot'} : {type:'BUY_PLINKO_SPECIAL',track:id as 'amplifier'|'return'|'splitter'|'jackpotBias'};
for (const batch of [1,6]) for (const order of ['original','cheapest'] as const) {
  for(let index=0;index<perVariant;index++) {
    const seed=seedStart+index;
    const base=createLiquidityPolicy(config,archetype,seed);
    const trace: object[]=[];
    const result=runFullGame(config, {id:`${base.id}+${order}+batch${batch}+timing-v2`,decide(ctx){
      let action=base.decide(ctx);
      if(order==='cheapest' && ['BUY_PLINKO_POCKET','BUY_PLINKO_SPECIAL','BUY_PLINKO_INSURANCE'].includes(action.type)) {
        const previews=buildCasinoUpgradePreviews(ctx.state,null,config);
        const id=action.type==='BUY_PLINKO_POCKET'||action.type==='BUY_PLINKO_SPECIAL'?action.track:'insurance';
        const price=previews.find(p=>p.id===id)!.nextPrice!;
        const candidates=previews.filter(p=>p.id!=='maxBet' && p.lockedReason===null && p.nextPrice!<=price).sort((a,b)=>a.nextPrice!-b.nextPrice!);
        if(candidates[0])action=buy(candidates[0].id);
      }
      trace.push({action,seconds:ctx.activeSeconds,gameMinutes:ctx.counters.gameMinutesAdvanced,cash:ctx.state.cash,drops:ctx.counters.plinkoDrops});return action;
    }}, {id:'unused',resolve(){throw Error('legacy payout path used');}}, {
      seed, configHash,maxDecisions:20000,maxGameMinutes:35*1440,
      execution: {
        decisionSeconds:decisionDelay,
        workSeconds:job=>job==='courier'?30:Number(config.work.jobs[job].minigame.timerRealSeconds),
        plinko(state,fraction){
          const world=createSharedWorld(state,config);
          try {
            let ticks=0;
            for(let launch=0;launch<batch;launch++) {
              if(!world.launch(fraction))break;
              for(let tick=0;tick<15;tick++){world.step();ticks++;}
            }
            while(world.active && ticks<3600){world.step();ticks++;}
            if(world.active)throw Error('Shared world exceeded 60 seconds');
            const snapshot=world.snapshot();
            return {...snapshot,seconds:ticks/60};
          } finally {world.destroy();}
        },
      },
    });
    runs.push({batch,order,result,trace});
    process.stderr.write(`${batch}/${order} ${index+1}: ${result.outcome}\n`);
  }
}
mkdirSync(output,{recursive:true});
const metadata={configHash,sourceRevision:execSync('git rev-parse HEAD').toString().trim(),perVariant,seedStart,archetype,decisionSeconds:decisionDelay,courierSecondsAssumed:30,workTimers:'dishes/trash full configured duration, not measured human completion',launchSpacingSeconds:0.25,mode:'bounded bursts then drain; no continuous replenishment; nominal 60Hz',limitations:'No offline time; no loading/render/save latency. Decision delay and courier duration are assumptions; menu delay clock carry unified instead of per scene. Income drawdown diagnostics are not sampled inside shared bursts.'};
writeFileSync(`${output}/runs.json.gz`,gzipSync(JSON.stringify({metadata,runs})));
const median=(a:number[])=>{a.sort((a,b)=>a-b);return a.length?a.length%2?a[Math.floor(a.length/2)]!:(a[a.length/2-1]!+a[a.length/2]!)/2:null;};
const summaries=[];
for(const batch of [1,6])for(const order of ['original','cheapest']) {
 const subset=runs.filter(r=>r.batch===batch&&r.order===order);
 const wins=subset.filter(r=>r.result.outcome==='VICTORY');
 summaries.push({batch,order,outcomes:subset.reduce<Record<string,number>>((a,r)=>{a[r.result.outcome]=(a[r.result.outcome]??0)+1;return a;},{}),wins:wins.length,medianWinMinutes:median(wins.map(r=>Object.values(r.result.diagnostics.activeSeconds!).reduce((a,b)=>a+b,0)/60)),medianWinWork:median(wins.map(r=>r.result.counters.workShifts)),medianWinRecovery:median(wins.map(r=>{const c=r.result.counters;return c.foodActions+c.sleeps+c.entertainmentActions+c.showers;})),medianWinDrops:median(wins.map(r=>r.result.counters.plinkoDrops)),medianAllMinutes:median(subset.map(r=>Object.values(r.result.diagnostics.activeSeconds!).reduce((a,b)=>a+b,0)/60))});
}
writeFileSync(`${output}/summary.json`,JSON.stringify({metadata,summaries},null,2));
