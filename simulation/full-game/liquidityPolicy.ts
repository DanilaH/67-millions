import type { BalanceConfig } from '../../src/config/balance.schema';
import { getBarryPaymentDue } from '../../src/core/barry/barry';
import { calculateActualBet } from '../../src/core/plinko-rules/drop';
import { getMaxBetForLevel } from '../../src/core/plinko-rules/progression';
import { startWork } from '../../src/core/work/work';
import { createBaselinePolicy, deterministicPolicyRoll, type BaselineArchetype } from './policies';
import { createHighVariancePolicy, type HighVarianceArchetype } from './highVariancePolicies';
import type { FullGamePolicy, FullGameDecision, FullGamePolicyContext } from './runner';

/** Additional T070 search policy. Original v1 reference policies stay unchanged. */
export const createLiquidityPolicy = (config: BalanceConfig, archetype: BaselineArchetype | HighVarianceArchetype, seed: number, maxBetReserveBets = 1): FullGamePolicy => {
  if (!Number.isFinite(maxBetReserveBets) || maxBetReserveBets < 1) throw Error('Invalid max-bet bankroll buffer');
  const base = archetype === 'DEGENERATE' || archetype === 'RECKLESS_NEEDS'
    ? createHighVariancePolicy(config, archetype, seed) : createBaselinePolicy(config, archetype, seed);
  const profile = base.profile;
  const reserveFor = (context: FullGamePolicyContext) => Math.round(getBarryPaymentDue(context.state,config)*profile.reserveMultiplier+profile.reserveFlat);
  const earning = (context: FullGamePolicyContext): FullGameDecision => {
    const {state,decisionIndex}=context;const reserve=reserveFor(context);
    if (archetype !== 'WORKER' && state.eventModifiers.plinkoLockRemainingMinutes===0) {
      const maxBet=getMaxBetForLevel(config,state.plinkoMaxBetLevel);
      const fraction=([1,0.5,0.25] as const).find(f=>state.cash-calculateActualBet(state.cash,maxBet,f)>=reserve);
      if(fraction!==undefined)return {type:'PLINKO',fraction};
    }
    for(const jobId of profile.workPriority){
      try{startWork(state,config,jobId,state.jobLevels[jobId]);}catch{continue;}
      const failed=deterministicPolicyRoll(seed,decisionIndex,`work:${archetype}:${jobId}`)<profile.workFailureProbability;
      return {type:'WORK',jobId,level:state.jobLevels[jobId],result:failed?'FAILURE':'SUCCESS'};
    }
    return {type:'WAIT',minutes:60};
  };
  return {id:`${base.id}+liquidity-v1${maxBetReserveBets===1?'':`+limit-buffer${maxBetReserveBets}`}`,decide:context=>{
    const original=base.decide(context);const {state}=context;const reserve=reserveFor(context);
    // Avoid buying a max-bet tier whose smallest quick bet cannot retain the policy's reserve.
    if(original.type==='BUY_PLINKO_MAX_BET'){
      const next=config.plinko.maxBetLevels.find(level=>level.level===state.plinkoMaxBetLevel+1)!;
      if(state.cash-next.price<reserve+Math.round(next.maxBet*0.25)*maxBetReserveBets)return earning(context);
    }
    // The aggressive search variant invests in a positive-EV path as well as raising limits.
    if(archetype==='AGGRESSIVE' && ['PLINKO','WORK','BUY_PLINKO_MAX_BET'].includes(original.type) && state.eventModifiers.plinkoLockRemainingMinutes===0){
      const budget=state.cash-reserve-Math.round(getMaxBetForLevel(config,state.plinkoMaxBetLevel)*0.25);
      for(const [track,levels,current] of [
        ['jackpot',config.plinko.jackpotUpgrades,state.plinkoJackpotLevel],
        ['mid',config.plinko.midUpgrades,state.plinkoMidLevel],
        ['center',config.plinko.centerUpgrades,state.plinkoCenterLevel],
      ] as const){
        const next=levels.find(level=>level.level===current+1);
        if(next && next.price<=budget)return {type:'BUY_PLINKO_POCKET',track};
      }
    }
    return original;
  }};
};
