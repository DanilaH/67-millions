import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { balance } from '../src/config/balance';
import { createInitialGameState } from '../src/core/state/GameState';
import { createMarginalIncomeEstimator, investmentScore } from '../simulation/full-game/marginalIncome';

describe('simulation marginal-income purchase gate', () => {
  it('rejects an upgrade that cannot recoup its price before the debt target', () => {
    expect(investmentScore(1000,1100,200000,1000000)).toBe(-Infinity);
    expect(investmentScore(1000,1100,100000,1000000)).toBe(-Infinity);
    expect(investmentScore(1000,1100,50000,1000000)).toBeCloseTo(.002);
  });
  it('permits improving a losing early board and rejects non-improvements', () => {
    expect(investmentScore(-10,-5,500,1000000)).toBeCloseTo(.01);
    expect(investmentScore(100,100,500,1000000)).toBe(-Infinity);
    expect(investmentScore(100,90,500,1000000)).toBe(-Infinity);
  });
  it('measures the same board independently of the live clock and event RNG', () => {
    const directory=mkdtempSync(join(tmpdir(),'67m-income-'));
    try {
      const state={...createInitialGameState(balance,123),cash:1e7,
        plinkoCenterLevel:2,plinkoMidLevel:3,plinkoJackpotLevel:3,
        plinkoAmplifierLevel:4,plinkoReturnLevel:4,plinkoSplitterLevel:5,plinkoJackpotBiasLevel:4};
      const a=join(directory,'before-checkpoint.json'),b=join(directory,'ordinary-time.json');
      createMarginalIncomeEstimator(balance,4,67146000,a)({...state,clock:{gameDayIndex:0,minuteOfDay:12*60+55}},'amplifier',9000000);
      createMarginalIncomeEstimator(balance,4,67146000,b)({...state,clock:{gameDayIndex:8,minuteOfDay:10*60+5}},'amplifier',9000000);
      expect(JSON.parse(readFileSync(a,'utf8')).measurements).toEqual(JSON.parse(readFileSync(b,'utf8')).measurements);
    } finally {rmSync(directory,{recursive:true,force:true});}
  });
});
