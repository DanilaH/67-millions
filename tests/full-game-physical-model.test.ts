import { describe, expect, it } from 'vitest';
import { balance } from '../src/config/balance';
import { createInitialGameState } from '../src/core/state/GameState';
import { commitBareDrop } from '../src/core/plinko-rules/drop';
import { derivePocketMultipliers } from '../src/core/plinko-rules/progression';
import { runCascadePhysicalDrops } from '../simulation/plinko/cascadeRunner';
import { createPhysicalPlinkoModel } from '../simulation/full-game/physicalPlinkoModel';

describe('full-game physical Plinko model', () => {
 it('uses the committed seed, actual physical outcome and consumed RNG state', () => {
  const original=createInitialGameState(balance,67070001);
  const committed=commitBareDrop(original,null,balance,'physical-1',1);
  const model=createPhysicalPlinkoModel();
  const context={state:committed.state,pendingDrop:committed.pendingDrop,config:balance,dropIndex:0};
  const expected=runCascadePhysicalDrops(balance,{runs:1,directSeed:true,seed:committed.pendingDrop.rngStateAtCommit,stake:committed.pendingDrop.originalStake,pocketMultipliers:derivePocketMultipliers(balance,committed.pendingDrop.pocketLevelsAtCommit),specialLevels:committed.pendingDrop.specialLevelsAtCommit})[0]!;
  expect(model.resolve(context)).toEqual({aggregatePayout:expected.aggregatePayout,nextRngState:expected.nextRngState});
  expect(model.resolve(context)).toEqual(model.resolve(context));
  expect(expected.nextRngState).not.toBe(original.rngState);
 });
 it('rejects a direct-seed batch that would reuse one seed for multiple Drops',()=>{
  expect(()=>runCascadePhysicalDrops(balance,{runs:2,directSeed:true,seed:67,pocketMultipliers:balance.plinko.basePockets,specialLevels:{amplifierLevel:0,returnLevel:0,splitterLevel:0,jackpotBiasLevel:0}})).toThrow('exactly one');
 });
});
