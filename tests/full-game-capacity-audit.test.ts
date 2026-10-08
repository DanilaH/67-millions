import {describe,it,expect} from 'vitest';
import {balance} from '../src/config/balance';
import {runFullGame,type FullGamePolicy} from '../simulation/full-game/runner';
const model={id:'unused',resolve(){throw Error('Unexpected drop');}};
const policy=(price:number):FullGamePolicy=>({id:'capacity-audit',decide:({counters})=>counters.purchases===0?{type:'AUDIT_BUY_CAPACITY',price,capacity:3}:{type:'STOP'}});
const execution={decisionSeconds:0,workSeconds:()=>0,plinko(){throw Error('Unexpected physics');}};
describe('diagnostic paid capacity',()=>{
 it('charges actual cash once and records the purchase before the next decision',()=>{
  const capacities:number[]=[];
  const r=runFullGame(balance,policy(200),model,{seed:123,configHash:'audit',execution:{...execution,onAuditCapacityPurchase:n=>capacities.push(n)}});
  expect(r.state.cash).toBe(balance.game.startCash-200);
  expect(r.counters.purchases).toBe(1);expect(capacities).toEqual([3]);
 });
 it('does not grant capacity when payment fails',()=>{
  const capacities:number[]=[];
  expect(()=>runFullGame(balance,policy(balance.game.startCash+1),model,{seed:123,configHash:'audit',execution:{...execution,onAuditCapacityPurchase:n=>capacities.push(n)}})).toThrow('Insufficient cash');
  expect(capacities).toEqual([]);
 });
 it('requires the explicit audit execution hook',()=>{
  expect(()=>runFullGame(balance,policy(200),model,{seed:123,configHash:'audit',execution})).toThrow('Invalid diagnostic capacity purchase');
 });
});

describe('production capacity in full-game simulation', () => {
 const realPolicy: FullGamePolicy = {id:'real-capacity',decide:({counters})=>counters.purchases===0?{type:'BUY_PLINKO_CAPACITY'}:{type:'STOP'}};
 it('uses the production price and durable level without an audit callback', () => {
  const config = {...balance,game:{...balance.game,startCash:10000}};
  const r=runFullGame(config,realPolicy,model,{seed:123,configHash:'audit'});
  expect(r.state.plinkoCapacityLevel).toBe(1);
  expect(r.state.cash).toBe(10000-balance.plinko.capacityLevels![1]!.price);
  expect(r.diagnostics.upgradeOrder).toEqual(['plinko:capacity:L1']);
 });
 it('rejects a production slot purchase when its actual price is unaffordable', () => {
  expect(()=>runFullGame(balance,realPolicy,model,{seed:123,configHash:'audit'})).toThrow('Insufficient cash');
 });
});
