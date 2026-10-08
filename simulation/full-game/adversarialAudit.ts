import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { parseBalanceConfig } from '../../src/config/balance';
import { getBarryPaymentDue } from '../../src/core/barry/barry';
import { calculateActualBet } from '../../src/core/plinko-rules/drop';
import { getLaunchCapacity, getMaxBetForLevel } from '../../src/core/plinko-rules/progression';
import { startWork } from '../../src/core/work/work';
import { buildCasinoUpgradePreviews, type CasinoUpgradeId } from '../../src/game/casino/casinoUiModel';
import { createLiquidityPolicy } from './liquidityPolicy';
import { createBaselinePolicy, deterministicPolicyRoll } from './policies';
import { runFullGame, type FullGameDecision, type FullGamePolicyContext, type FullGameRunResult } from './runner';
import { runContinuousSession } from './continuousSession';
import { createSharedWorld } from './sharedWorld';

const strategies = ['cheapest', 'skip-finals', 'skip-splitter', 'thin-reserve', 'insurance-first', 'insurance-cycle', 'stake-first', 'specials-first', 'hoard-12', 'worker', 'casino-only', 'ignore-needs'] as const;
type Strategy = typeof strategies[number];
const strategy = process.argv[2] as Strategy;
const count = Number(process.argv[3] ?? 24);
const seedStart = Number(process.argv[4] ?? 67140000);
const output = process.argv[5] ?? `reports/pacing/2026-10-08-adversarial/${strategy}`;
const mode = process.argv[6] ?? 'continuous';
const pace = process.argv[7] ?? 'fast';
if (!strategies.includes(strategy) || !Number.isInteger(count) || count < 1 || !Number.isInteger(seedStart) || seedStart < 1 || !['burst', 'continuous'].includes(mode) || !['fast', 'ordinary'].includes(pace)) throw Error('Invalid audit arguments');
const raw = readFileSync(process.argv[8] ?? 'balance.v0.json', 'utf8');
const config = parseBalanceConfig(JSON.parse(raw));
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const configHash = hash(raw);
const buy = (id: CasinoUpgradeId): FullGameDecision => id === 'capacity' ? {type:'BUY_PLINKO_CAPACITY'}
  : id === 'insurance' ? {type:'BUY_PLINKO_INSURANCE'} : id === 'maxBet' ? {type:'BUY_PLINKO_MAX_BET'}
  : id === 'center' || id === 'mid' || id === 'jackpot' ? {type:'BUY_PLINKO_POCKET',track:id}
  : {type:'BUY_PLINKO_SPECIAL',track:id};
const median = (a: number[]) => { a.sort((a,b)=>a-b); return a.length ? (a[Math.floor((a.length-1)/2)]! + a[Math.floor(a.length/2)]!)/2 : null; };
const runs: {seed:number;result:FullGameRunResult;trace:object[];sessions:object[]}[] = [];
for (let index = 0; index < count; index++) {
  const seed = createHash('sha256').update(`${seedStart}:${index}`).digest().readUInt32BE(0) || 1;
  const base = strategy === 'worker' ? createLiquidityPolicy(config, 'WORKER', seed) : createLiquidityPolicy(config, 'BASELINE_GROWTH', seed);
  const profile = createBaselinePolicy(config, 'BASELINE_GROWTH', seed).profile;
  const trace: object[] = [];
  const sessions: object[] = [];
  const decide = (ctx: FullGamePolicyContext): FullGameDecision => {
    const original = base.decide(ctx);
    const s = ctx.state;
    if (strategy === 'worker') return original;
    if (['EVENT_CHOICE','PAY_MAIN_DEBT'].includes(original.type)) return original;
    if (strategy !== 'ignore-needs' && !['PLINKO','WORK','WAIT','BUY_PLINKO_MAX_BET','BUY_PLINKO_POCKET','BUY_PLINKO_SPECIAL','BUY_PLINKO_INSURANCE'].includes(original.type)) return original;
    const reserve = strategy === 'thin-reserve' ? getBarryPaymentDue(s,config)*1.15+1000 : strategy === 'ignore-needs' || strategy === 'casino-only' ? 0 : getBarryPaymentDue(s,config)*profile.reserveMultiplier + profile.reserveFlat;
    const boardLevels = s.plinkoCenterLevel+s.plinkoMidLevel+s.plinkoJackpotLevel+s.plinkoAmplifierLevel+s.plinkoReturnLevel+s.plinkoSplitterLevel+s.plinkoJackpotBiasLevel;
    const rank = (id: CasinoUpgradeId) => strategy.startsWith('insurance') && id === 'insurance' ? 0
      : strategy === 'stake-first' && id === 'maxBet' ? 0
      : strategy === 'specials-first' && ['amplifier','return','splitter','jackpotBias'].includes(id) ? 0 : 1;
    if (s.eventModifiers.plinkoLockRemainingMinutes === 0 && strategy !== 'casino-only' && !(strategy === 'hoard-12' && boardLevels >= 12)) {
      const choices = buildCasinoUpgradePreviews(s,null,config)
        .filter(p => !p.maxed && p.lockedReason === null && p.nextPrice !== null)
        .filter(p => strategy.startsWith('insurance') || p.id !== 'insurance')
        .filter(p => !(strategy === 'skip-finals' && ['amplifier','return','splitter'].includes(p.id) && p.currentLevel === config.plinko[p.id as 'amplifier'|'return'|'splitter'].at(-1)!.level-1))
        .filter(p => !(strategy === 'skip-splitter' && p.id === 'splitter' && p.currentLevel === config.plinko.splitter.at(-1)!.level-1))
        .filter(p => s.cash-p.nextPrice! >= reserve + getMaxBetForLevel(config,s.plinkoMaxBetLevel+(p.id==='maxBet'?1:0))*0.25)
        .sort((a,b)=>rank(a.id)-rank(b.id)||a.nextPrice!-b.nextPrice!);
      if (choices[0]) return buy(choices[0].id);
    }
    if (s.eventModifiers.plinkoLockRemainingMinutes === 0 && s.cash > 0) {
      const maxBet = getMaxBetForLevel(config,s.plinkoMaxBetLevel);
      const fractions = strategy === 'insurance-cycle' && !s.plinkoInsuranceArmed ? [0.25] as const : [1,0.5,0.25] as const;
      const fraction = fractions.find(f => s.cash-calculateActualBet(s.cash,maxBet,f) >= reserve);
      if (fraction !== undefined) return {type:'PLINKO',fraction};
    }
    if (strategy === 'casino-only') return {type:'WAIT',minutes:60};
    for (const jobId of profile.workPriority) {
      try { startWork(s,config,jobId,s.jobLevels[jobId]); } catch { continue; }
      return {type:'WORK',jobId,level:s.jobLevels[jobId],result:deterministicPolicyRoll(seed,ctx.decisionIndex,`adversarial:${jobId}`) < 0.08 ? 'FAILURE' : 'SUCCESS'};
    }
    return {type:'WAIT',minutes:60};
  };
  let context: FullGamePolicyContext;
  const result = runFullGame(config,{id:`adversarial-v1:${strategy}:${mode}:${pace}`,decide(ctx) {
    context = ctx;
    const action = decide(ctx);
    trace.push({action,seconds:ctx.activeSeconds,cash:ctx.state.cash,clock:ctx.state.clock,needs:ctx.state.needs,
      capacity:getLaunchCapacity(config,ctx.state),insurance:ctx.state.plinkoInsuranceLevel,armed:ctx.state.plinkoInsuranceArmed,
      levels:{center:ctx.state.plinkoCenterLevel,mid:ctx.state.plinkoMidLevel,jackpot:ctx.state.plinkoJackpotLevel,amplifier:ctx.state.plinkoAmplifierLevel,return:ctx.state.plinkoReturnLevel,splitter:ctx.state.plinkoSplitterLevel,guides:ctx.state.plinkoJackpotBiasLevel,maxBet:ctx.state.plinkoMaxBetLevel}});
    return action;
  }},{id:'unused-physical-hook-required',resolve(){throw Error('Legacy payout model invoked');}},{seed,configHash,maxDecisions:20000,maxGameMinutes:35*1440,execution:{
    decisionSeconds:pace==='fast'?0.25:2,
    workSeconds:job=>pace==='fast'?(job==='courier'?6:job==='trash'?5:8):(job==='courier'?12:job==='trash'?15:18),
    plinko(state,fraction) {
      const intent = (current: {state:typeof state; launches:number; advancedMinutes:number}) => decide({...context,state:current.state,counters:{...context.counters,plinkoDrops:context.counters.plinkoDrops+current.launches,gameMinutesAdvanced:context.counters.gameMinutesAdvanced+current.advancedMinutes}});
      if(mode==='continuous') {
        const r=runContinuousSession(state,config,fraction,intent);
        sessions.push({seconds:context.activeSeconds,...r.diagnostics}); return r;
      }
      const world=createSharedWorld(state,config);let ticks=0;
      try {
        for(let launch=0;launch<getLaunchCapacity(config,state);launch++) {
          const action=launch===0?{type:'PLINKO' as const,fraction}:intent(world.observe());
          if(action.type!=='PLINKO'||!world.launch(action.fraction??fraction))break;
          for(let tick=0;tick<15;tick++){world.step();ticks++;}
        }
        while(world.active&&ticks<3600){world.step();ticks++;}
        if(world.active)throw Error('Burst exceeded 60 seconds');
        const r=world.snapshot();return {...r,seconds:ticks/60};
      } finally {world.destroy();}
    },
  }});
  runs.push({seed,result,trace,sessions});
  process.stderr.write(`${strategy}/${mode}/${pace} ${index+1}/${count}: ${result.outcome}\n`);
}
mkdirSync(output,{recursive:true});
const sources=Object.fromEntries(['simulation/full-game/adversarialAudit.ts','simulation/full-game/runner.ts','simulation/full-game/sharedWorld.ts','simulation/full-game/continuousSession.ts','src/core/plinko-rules/insurance.ts'].map(p=>[p,hash(readFileSync(p,'utf8'))]));
const metadata={configHash,revision:execSync('git rev-parse HEAD').toString().trim(),sources,strategy,mode,pace,count,seedStart,seedSampling:'SHA256(seedStart:index) first uint32; matched seeds across strategies',model:'shared production board resolver and Phaser Matter fork; core purchases including real paid capacity; core insurance settlement',timing:{decisionSeconds:pace==='fast'?0.25:2,workSeconds:pace==='fast'?{courier:6,trash:5,dishes:8}:{courier:12,trash:15,dishes:18},launchSpacingSeconds:0.25},limitations:'Bot policies, assumed human input times, 8% work failures; no render/load/save delays. No claim of human difficulty. Decision clock carry unified across menus; drawdown not sampled within cascades.'};
writeFileSync(`${output}/runs.json.gz`,gzipSync(JSON.stringify({metadata,runs})));
const minutes=(r:typeof runs[number])=>Object.values(r.result.diagnostics.activeSeconds!).reduce((a,b)=>a+b,0)/60;
const wins=runs.filter(r=>r.result.outcome==='VICTORY');
const q=(fraction:number)=>{const a=wins.map(minutes).sort((a,b)=>a-b);return a.length?a[Math.floor((a.length-1)*fraction)]:null;};
const summary={metadata,outcomes:runs.reduce<Record<string,number>>((a,r)=>{a[r.result.outcome]=(a[r.result.outcome]??0)+1;return a;},{}),wins:wins.length,medianWinMinutes:median(wins.map(minutes)),p10WinMinutes:q(0.1),p90WinMinutes:q(0.9),minimumWinMinutes:wins.length?Math.min(...wins.map(minutes)):null,medianAllMinutes:median(runs.map(minutes)),medianWinWork:median(wins.map(r=>r.result.counters.workShifts)),medianWinDrops:median(wins.map(r=>r.result.counters.plinkoDrops)),fastestSeed:wins.slice().sort((a,b)=>minutes(a)-minutes(b))[0]?.seed??null};
writeFileSync(`${output}/summary.json`,JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary));
