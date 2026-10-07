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
