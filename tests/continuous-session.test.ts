import { expect, it } from 'vitest';
import { balance } from '../src/config/balance';
import { createInitialGameState } from '../src/core/state/GameState';
import { runContinuousSession } from '../simulation/full-game/continuousSession';

it('reuses freed slots, then drains every paid root before allowing a purchase', () => {
  const initial = { ...createInitialGameState(balance, 67111001), cash: 100_000, plinkoCapacityLevel: 3 };
  const result = runContinuousSession(initial, balance, .25, current => current.launches < 12
    ? { type:'PLINKO', fraction:.25 } : { type:'BUY_PLINKO_MAX_BET' });
  expect(result.launches).toBe(12);
  expect(result.diagnostics.refillLaunches).toBe(6);
  expect(result.diagnostics.sampledMaxRoots).toBeLessThanOrEqual(balance.plinko.maxConcurrentDrops);
  expect(result.pending).toBeNull();
  expect(result.settlements).toHaveLength(12);
  expect(result.state.cash).toBe(initial.cash + result.settlements.reduce((sum,s)=>sum+s.payout-s.stake,0));
  expect(result.state.plinkoMaxBetLevel).toBe(initial.plinkoMaxBetLevel);
  expect(result.diagnostics.stopReason).toBe('BUY_PLINKO_MAX_BET');
  expect(result.diagnostics.drainSeconds).toBeGreaterThan(0);
});

it('stops adding roots at a recovery intention, without discarding the paid root', () => {
  const initial = { ...createInitialGameState(balance, 67111002), cash: 100_000, plinkoCapacityLevel: 3 };
  const result = runContinuousSession(initial, balance, .5, () => ({type:'SLEEP'}));
  expect(result.launches).toBe(1);
  expect(result.settlements).toHaveLength(1);
  expect(result.pending).toBeNull();
  expect(result.diagnostics.stopReason).toBe('SLEEP');
  expect(result.state.cash).toBe(initial.cash + result.settlements[0]!.payout - result.settlements[0]!.stake);
});
