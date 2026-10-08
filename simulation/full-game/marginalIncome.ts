import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { BalanceConfig } from '../../src/config/balance.schema';
import { createInitialGameState, type GameState } from '../../src/core/state/GameState';
import { buildCasinoUpgradePreviews, type CasinoUpgradeId } from '../../src/game/casino/casinoUiModel';
import { getLaunchCapacity, getMaxBetForLevel, purchaseCapacityUpgrade, purchaseMaxBetUpgrade, purchasePocketUpgrade, purchaseSpecialUpgrade } from '../../src/core/plinko-rules/progression';
import { createSharedWorld } from './sharedWorld';

/** Estimated purchase value only. The full-game runner still executes real rules. */
export const investmentScore = (baseRate: number, nextRate: number, price: number, debtRemaining: number): number => {
  const delta = nextRate - baseRate;
  if (delta <= 0 || price <= 0) return -Infinity;
  // Buying is useful only if expected finish time after spending is shorter.
  if (baseRate > 0 && price * baseRate >= Math.max(0, debtRemaining) * delta) return -Infinity;
  return delta / price;
};

const fields = ['plinkoCenterLevel','plinkoMidLevel','plinkoJackpotLevel','plinkoAmplifierLevel','plinkoReturnLevel','plinkoSplitterLevel','plinkoJackpotBiasLevel'] as const;
interface Measurement { mean: number; seconds: number; standardError: number; }
export const createMarginalIncomeEstimator = (config: BalanceConfig, count: number, seedStart: number, cachePath: string) => {
  if (!Number.isInteger(count) || count < 2) throw Error('At least two measurement seeds required');
  const configHash = createHash('sha256').update(JSON.stringify(config)).digest('hex');
  const identity = {configHash,count,seedStart,model:'normalized-paired-single-root-capacity-proxy-v2'};
  const cache: Record<string,Measurement> = {};
  if (existsSync(cachePath)) {
    const saved = JSON.parse(readFileSync(cachePath,'utf8'));
    if (JSON.stringify(saved.identity)!==JSON.stringify(identity)) throw Error('Income cache provenance mismatch');
    Object.assign(cache,saved.measurements);
  }
  const seeds = Array.from({length:count},(_,i)=>createHash('sha256').update(`${seedStart}:${i}`).digest().readUInt32BE(0)||1);
  const measure = (state: GameState): Measurement => {
    const key=fields.map(f=>state[f]).join('/');
    if (cache[key]) return cache[key];
    const values: number[]=[]; let totalTicks=0;
    for (const seed of seeds) {
      // A probe must not inherit the current clock: a crossed event checkpoint
      // consumes RNG before spawning and makes the board-only cache invalid.
      const w=createSharedWorld({...createInitialGameState(config,seed),cash:1e9,
        ...Object.fromEntries(fields.map(f=>[f,state[f]]))},config);
      try {
        if(!w.launch(1))throw Error('Income probe launch rejected');
        let ticks=0; while(w.active&&ticks<3600){w.step();ticks++;}
        if(w.active)throw Error('Income probe unresolved');
        const r=w.snapshot().settlements[0]!; values.push(r.payout/r.stake);totalTicks+=ticks;
      } finally {w.destroy();}
    }
    const mean=values.reduce((a,b)=>a+b,0)/count;
    const m={mean,seconds:totalTicks/count/60,standardError:Math.sqrt(values.reduce((s,v)=>s+(v-mean)**2,0)/(count-1)/count)};
    cache[key]=m;mkdirSync(dirname(cachePath),{recursive:true});
    writeFileSync(cachePath,JSON.stringify({identity,limitations:'Proxy ranks income using single-root mean/flight time × paid capacity × max bet. Ignores concurrent collisions, insurance, variance/bankroll, needs and lookahead. Full-game execution tests actual outcomes; not an optimal solver.',measurements:cache},null,2));
    return m;
  };
  const rate=(s:GameState,m:Measurement)=>(m.mean-1)*getMaxBetForLevel(config,s.plinkoMaxBetLevel)*getLaunchCapacity(config,s)/m.seconds;
  return (state: GameState, id: CasinoUpgradeId, price: number, lookahead = false): number => {
    if(id==='insurance')return -Infinity;
    const base=measure(state);
    if((id==='maxBet'||id==='capacity')&&base.mean-1<=1.96*base.standardError)return -Infinity;
    const advance = (s:GameState) => id==='capacity'?purchaseCapacityUpgrade(s,null,config)
      :id==='maxBet'?purchaseMaxBetUpgrade(s,null,config)
      :id==='center'||id==='mid'||id==='jackpot'?purchasePocketUpgrade(s,null,config,id)
      :purchaseSpecialUpgrade(s,null,config,id);
    let next=advance({...state,cash:1e12}), totalPrice=price;
    let best=investmentScore(rate(state,base),rate(next,measure(next)),totalPrice,config.game.mainDebt-state.cash);
    if (lookahead) {
      // Count all prerequisite costs. Only the first purchase executes now.
      while (true) {
        const preview=buildCasinoUpgradePreviews(next,null,config).find(p=>p.id===id);
        if(!preview||preview.maxed||preview.nextPrice===null)break;
        totalPrice+=preview.nextPrice;next=advance(next);
        best=Math.max(best,investmentScore(rate(state,base),rate(next,measure(next)),totalPrice,config.game.mainDebt-state.cash));
      }
    }
    return best;
  };
};
