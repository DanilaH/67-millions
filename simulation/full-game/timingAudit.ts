import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { parseBalanceConfig } from '../../src/config/balance';
import { buildCasinoUpgradePreviews, type CasinoUpgradeId } from '../../src/game/casino/casinoUiModel';
import { startWork } from '../../src/core/work/work';
import { getBarryPaymentDue } from '../../src/core/barry/barry';
import { getMaxBetForLevel } from '../../src/core/plinko-rules/progression';
import { createBaselinePolicy, deterministicPolicyRoll } from './policies';
import { createLiquidityPolicy } from './liquidityPolicy';
import { runFullGame, type FullGameDecision, type FullGamePolicyContext } from './runner';
import { createSharedWorld } from './sharedWorld';
import { runContinuousSession } from './continuousSession';
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
const mode = process.argv[8] ?? 'burst';
if (!['burst','continuous','continuous-spend'].includes(mode)) throw Error('Unsupported launch mode');
const batches = process.env.AUDIT_BATCHES ? process.env.AUDIT_BATCHES.split(',').map(Number) : mode !== 'burst' ? [6] : [1, 6];
if(batches.some(n=>!Number.isInteger(n)||n<1||n>6))throw Error('Invalid diagnostic batches');
const capacityLadder: { purchases:number; capacity:number }[] | null = process.env.AUDIT_CAPACITY_LADDER ? JSON.parse(process.env.AUDIT_CAPACITY_LADDER) : null;
if(capacityLadder && (!capacityLadder.length || capacityLadder[0]!.purchases!==0 || capacityLadder.some((r,i)=>!Number.isInteger(r.capacity)||r.capacity<1||r.capacity>6||!Number.isInteger(r.purchases)||r.purchases<0||(i>0&&r.purchases<=capacityLadder[i-1]!.purchases))))throw Error('Invalid capacity ladder');
const capacityFor = (state: FullGamePolicyContext['state']) => {
 const purchased=state.plinkoCenterLevel+state.plinkoMidLevel+state.plinkoJackpotLevel+state.plinkoAmplifierLevel+state.plinkoReturnLevel+state.plinkoSplitterLevel+state.plinkoJackpotBiasLevel;
 return capacityLadder ? capacityLadder.filter(r=>r.purchases<=purchased).at(-1)!.capacity : config.plinko.maxConcurrentDrops;
};
const runnerHash=createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex');
const maxBetReserveBets = Number(process.argv[9] ?? 1);
const approach = process.argv[10] ?? 'reserve';
if (!['reserve', 'casino-first', 'casino-invest', 'payback'].includes(approach)) throw Error('Unsupported approach');
const paybackPath = approach==='payback' ? JSON.parse(readFileSync(process.argv[11]!, 'utf8')).stages as {levels:Record<string,number>;chosen:{id:CasinoUpgradeId}}[] : null;
const paidCapacity: {capacity:number;price:number}[] | null=process.env.AUDIT_PAID_CAPACITY?JSON.parse(process.env.AUDIT_PAID_CAPACITY):null;
if(paidCapacity && (capacityLadder || paidCapacity.length!==3 || paidCapacity.some((r,i)=>r.capacity!==[3,4,6][i]||!Number.isInteger(r.price)||r.price<=0)))throw Error('Invalid paid capacity');
const capacityPolicy=process.env.AUDIT_CAPACITY_POLICY??'cheapest';
if(!['cheapest','first','skip'].includes(capacityPolicy))throw Error('Invalid capacity policy');
const strategy=process.env.AUDIT_STRATEGY??'cheapest';
if(!['cheapest','stake-first','specials-first','stop-at-12'].includes(strategy))throw Error('Invalid strategy');
const reserveScale=Number(process.env.AUDIT_RESERVE_SCALE??1);
if(![0,1].includes(reserveScale))throw Error('Invalid reserve scale');
const diverseSeeds=process.env.AUDIT_DIVERSE_SEEDS==='1';
const purchaseAll=process.env.AUDIT_PURCHASE_POLICY==='all';
const skipFinal=process.env.AUDIT_SKIP_FINAL??null;
if(skipFinal&&!['splitter','return','amplifier'].includes(skipFinal))throw Error('Invalid skip track');
const orders = purchaseAll ? ['original'] as const : paybackPath ? ['original'] as const : ['original','cheapest'] as const;
const runs = [];
const buy = (id: CasinoUpgradeId): FullGameDecision => id === 'maxBet' ? { type: 'BUY_PLINKO_MAX_BET' } : id === 'insurance' ? {type:'BUY_PLINKO_INSURANCE'} : ['center','mid','jackpot'].includes(id) ? {type:'BUY_PLINKO_POCKET',track:id as 'center'|'mid'|'jackpot'} : {type:'BUY_PLINKO_SPECIAL',track:id as 'amplifier'|'return'|'splitter'|'jackpotBias'};
for (const batch of batches) for (const order of orders) {
  for(let index=0;index<perVariant;index++) {
    const seed=diverseSeeds?(createHash('sha256').update(`${seedStart}:${index}`).digest().readUInt32BE(0)||1):seedStart+index;
    let paidCapacityLevel=0;
    const currentCapacity=(state:FullGamePolicyContext['state'])=>paidCapacity ? (paidCapacityLevel===0?2:paidCapacity[paidCapacityLevel-1]!.capacity):capacityFor(state);
    const profile=createBaselinePolicy(config,archetype,seed).profile;
    const liquidity=createLiquidityPolicy(config,archetype,seed,maxBetReserveBets);
    const base = {...liquidity, decide(ctx: FullGamePolicyContext): FullGameDecision {
      const action = liquidity.decide(ctx);
      if(purchaseAll && ['PLINKO','WORK','WAIT','BUY_PLINKO_MAX_BET','BUY_PLINKO_POCKET','BUY_PLINKO_SPECIAL','BUY_PLINKO_INSURANCE'].includes(action.type) && ctx.state.eventModifiers.plinkoLockRemainingMinutes===0){
        const reserve=(getBarryPaymentDue(ctx.state,config)*profile.reserveMultiplier+profile.reserveFlat)*reserveScale;
        const done= strategy==='stop-at-12' && ctx.state.plinkoCenterLevel+ctx.state.plinkoMidLevel+ctx.state.plinkoJackpotLevel+ctx.state.plinkoAmplifierLevel+ctx.state.plinkoReturnLevel+ctx.state.plinkoSplitterLevel+ctx.state.plinkoJackpotBiasLevel>=12;
        const choices=buildCasinoUpgradePreviews(ctx.state,null,config).filter(p=>p.id!=='insurance'&&p.id!=='capacity'&&p.lockedReason===null&&p.nextPrice!==null)
          .filter(()=>!done)
          .filter(p=>!(p.id===skipFinal&&p.currentLevel===config.plinko[p.id as 'splitter'|'return'|'amplifier'].at(-1)!.level-1))
          .filter(p=>ctx.state.cash-p.nextPrice! >= reserve+getMaxBetForLevel(config,ctx.state.plinkoMaxBetLevel+(p.id==='maxBet'?1:0))*0.25)
          .sort((a,b)=>{const rank=(id:string)=>strategy==='stake-first'?(id==='maxBet'?0:1):strategy==='specials-first'?(['amplifier','return','splitter','jackpotBias'].includes(id)?0:1):0;return rank(a.id)-rank(b.id)||a.nextPrice!-b.nextPrice!;});
        const nextCapacity=paidCapacity?.[paidCapacityLevel];
        if(!done && nextCapacity && capacityPolicy!=='skip' && ctx.state.cash-nextCapacity.price>=reserve+getMaxBetForLevel(config,ctx.state.plinkoMaxBetLevel)*0.25 && (capacityPolicy==='first'||!choices[0]||nextCapacity.price<=choices[0].nextPrice!))return {type:'AUDIT_BUY_CAPACITY',...nextCapacity};
        if(choices[0])return buy(choices[0].id);
        const cap=getMaxBetForLevel(config,ctx.state.plinkoMaxBetLevel);
        const fraction=reserveScale===0&&ctx.state.cash>0?1:([1,0.5,0.25] as const).find(f=>ctx.state.cash-cap*f>=reserve);
        if(fraction)return {type:'PLINKO',fraction};
        for(const jobId of profile.workPriority){
          try{startWork(ctx.state,config,jobId,ctx.state.jobLevels[jobId]);}catch{continue;}
          return {type:'WORK',jobId,level:ctx.state.jobLevels[jobId],result:deterministicPolicyRoll(seed,ctx.decisionIndex,`work:${archetype}:${jobId}`)<profile.workFailureProbability?'FAILURE':'SUCCESS'};
        }
        return {type:'WAIT',minutes:60};
      }
      if (paybackPath && ['WORK','WAIT','PLINKO','BUY_PLINKO_MAX_BET','BUY_PLINKO_POCKET','BUY_PLINKO_SPECIAL','BUY_PLINKO_INSURANCE'].includes(action.type)
          && ctx.state.eventModifiers.plinkoLockRemainingMinutes===0) {
        const stage=paybackPath.find(s=>Object.entries(s.levels).every(([k,v])=>ctx.state[k as keyof typeof ctx.state]===v));
        const reserve=getBarryPaymentDue(ctx.state,config)*profile.reserveMultiplier+profile.reserveFlat;
        if(stage){
          const preview=buildCasinoUpgradePreviews(ctx.state,null,config).find(p=>p.id===stage.chosen.id)!;
          const cap=stage.chosen.id==='maxBet'?getMaxBetForLevel(config,ctx.state.plinkoMaxBetLevel+1):getMaxBetForLevel(config,ctx.state.plinkoMaxBetLevel);
          if(preview.lockedReason===null && ctx.state.cash-preview.nextPrice! >= reserve+cap*0.25) return buy(stage.chosen.id);
        }
        const cap=getMaxBetForLevel(config,ctx.state.plinkoMaxBetLevel);
        const fraction=([0.5,0.25] as const).find(f=>ctx.state.cash-cap*f>=reserve);
        if(fraction)return {type:'PLINKO',fraction};
        for(const jobId of profile.workPriority){
          try{startWork(ctx.state,config,jobId,ctx.state.jobLevels[jobId]);}catch{continue;}
          return {type:'WORK',jobId,level:ctx.state.jobLevels[jobId],result:deterministicPolicyRoll(seed,ctx.decisionIndex,`work:${archetype}:${jobId}`)<profile.workFailureProbability?'FAILURE':'SUCCESS'};
        }
        return {type:'WAIT',minutes:60};
      }
      if (approach === 'casino-invest' && ['WORK','WAIT','PLINKO','BUY_PLINKO_MAX_BET','BUY_PLINKO_POCKET','BUY_PLINKO_SPECIAL'].includes(action.type)
          && ctx.state.eventModifiers.plinkoLockRemainingMinutes === 0) {
        const choices = buildCasinoUpgradePreviews(ctx.state,null,config)
          .filter(p=>p.lockedReason === null && p.nextPrice !== null && ctx.state.cash - p.nextPrice >= 125)
          .sort((a,b)=>a.nextPrice!-b.nextPrice!);
        if (choices[0]) return buy(choices[0].id);
        if (ctx.state.cash > 0) return {type:'PLINKO',fraction:1};
      }
      return approach === 'casino-first' && ['WORK','WAIT'].includes(action.type)
        && ctx.state.cash > 0 && ctx.state.eventModifiers.plinkoLockRemainingMinutes === 0
        ? {type:'PLINKO',fraction:1} : action;
    }};
    const trace: object[]=[];
    const sessions: object[]=[];
    let context: FullGamePolicyContext;
    const result=runFullGame(config, {id:`${base.id}+${order}+batch${batch}+${mode}+timing-v3`,decide(ctx){
      context=ctx;
      let action=base.decide(ctx);
      if(order==='cheapest' && ['BUY_PLINKO_POCKET','BUY_PLINKO_SPECIAL','BUY_PLINKO_INSURANCE'].includes(action.type)) {
        const previews=buildCasinoUpgradePreviews(ctx.state,null,config);
        const id=action.type==='BUY_PLINKO_POCKET'||action.type==='BUY_PLINKO_SPECIAL'?action.track:'insurance';
        const price=previews.find(p=>p.id===id)!.nextPrice!;
        const candidates=previews.filter(p=>p.id!=='maxBet' && p.lockedReason===null && p.nextPrice!<=price).sort((a,b)=>a.nextPrice!-b.nextPrice!);
        if(candidates[0])action=buy(candidates[0].id);
      }
      trace.push({action,seconds:ctx.activeSeconds,gameMinutes:ctx.counters.gameMinutesAdvanced,cash:ctx.state.cash,drops:ctx.counters.plinkoDrops,needs:ctx.state.needs,capacity:currentCapacity(ctx.state),levels:{center:ctx.state.plinkoCenterLevel,mid:ctx.state.plinkoMidLevel,jackpot:ctx.state.plinkoJackpotLevel,amplifier:ctx.state.plinkoAmplifierLevel,return:ctx.state.plinkoReturnLevel,splitter:ctx.state.plinkoSplitterLevel,guides:ctx.state.plinkoJackpotBiasLevel,maxBet:ctx.state.plinkoMaxBetLevel}});return action;
    }}, {id:'unused',resolve(){throw Error('legacy payout path used');}}, {
      seed, configHash,maxDecisions:20000,maxGameMinutes:35*1440,
      execution: {
        onAuditCapacityPurchase:paidCapacity ? capacity=>{if(paidCapacity[paidCapacityLevel]?.capacity!==capacity)throw Error('Out of order capacity purchase');paidCapacityLevel++;}:undefined,
        decisionSeconds:decisionDelay,
        workSeconds:job=>job==='courier'?30:Number(config.work.jobs[job].minigame.timerRealSeconds),
        plinko(state,fraction){
          // Free unlock proxy tied to already-owned board levels; not a paid upgrade implementation.
          const sessionConfig=(capacityLadder||paidCapacity) ? {...config,plinko:{...config.plinko,capacityLevels:undefined,maxConcurrentDrops:currentCapacity(state)}} : config;
          if (mode !== 'burst') {
            const result=runContinuousSession(state, sessionConfig, fraction, current => {
              const intention=base.decide({
                ...context, state:current.state,
                counters:{...context.counters,plinkoDrops:context.counters.plinkoDrops+current.launches,gameMinutesAdvanced:context.counters.gameMinutesAdvanced+current.advancedMinutes},
              });
              return mode === 'continuous-spend' && ['WORK','WAIT'].includes(intention.type)
                ? {type:'PLINKO',fraction} : intention;
            });
            sessions.push({seconds:context.activeSeconds,...result.diagnostics});
            return result;
          }
          const world=createSharedWorld(state,sessionConfig);
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
    runs.push({batch,order,result,trace,sessions});
    process.stderr.write(`${batch}/${order} ${index+1}: ${result.outcome}\n`);
  }
}
mkdirSync(output,{recursive:true});
const metadata={strategy,reserveScale,seedSampling:diverseSeeds?'sha256 seedStart:index first uint32, zero mapped to one':'adjacent integers',paidCapacity,capacityPolicy,purchaseAll,skipFinal,capacityLadder,capacitySemantics:capacityLadder?'free unlocks based on total purchased board levels; excludes maxBet and insurance; diagnostic proxy, no price or manual batch UI':'production capacity',batches,runnerHash,paybackPath:process.argv[11]??null,approach,configHash,sourceRevision:execSync('git rev-parse HEAD').toString().trim(),perVariant,seedStart,archetype,maxBetReserveBets,decisionSeconds:decisionDelay,courierSecondsAssumed:30,workTimers:'dishes/trash full configured duration, not measured human completion',launchSpacingSeconds:0.25,mode,launchPolicy:mode==='burst'?'bounded bursts then drain':`recheck every 15 ticks; drain for recovery/event/purchase/victory; ${mode==='continuous-spend'?'reuse original fraction without cash reserve inside session':'preserve liquidity reserve, drain on work intention'}; no purchases while active`,fixedHz:60,limitations:'No offline time; no loading/render/save latency. Decision delay and courier duration are assumptions; menu delay clock carry unified instead of per scene. Income drawdown diagnostics are not sampled inside shared bursts.'};
writeFileSync(`${output}/runs.json.gz`,gzipSync(JSON.stringify({metadata,runs})));
const median=(a:number[])=>{a.sort((a,b)=>a-b);return a.length?a.length%2?a[Math.floor(a.length/2)]!:(a[a.length/2-1]!+a[a.length/2]!)/2:null;};
const summaries=[];
for(const batch of batches)for(const order of orders) {
 const subset=runs.filter(r=>r.batch===batch&&r.order===order);
 const wins=subset.filter(r=>r.result.outcome==='VICTORY');
 summaries.push({batch,order,outcomes:subset.reduce<Record<string,number>>((a,r)=>{a[r.result.outcome]=(a[r.result.outcome]??0)+1;return a;},{}),wins:wins.length,medianWinMinutes:median(wins.map(r=>Object.values(r.result.diagnostics.activeSeconds!).reduce((a,b)=>a+b,0)/60)),medianWinWork:median(wins.map(r=>r.result.counters.workShifts)),medianWinRecovery:median(wins.map(r=>{const c=r.result.counters;return c.foodActions+c.sleeps+c.entertainmentActions+c.showers;})),medianWinDrops:median(wins.map(r=>r.result.counters.plinkoDrops)),medianAllMinutes:median(subset.map(r=>Object.values(r.result.diagnostics.activeSeconds!).reduce((a,b)=>a+b,0)/60))});
}
writeFileSync(`${output}/summary.json`,JSON.stringify({metadata,summaries},null,2));
