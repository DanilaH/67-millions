import { expect, it } from 'vitest';
import { balance } from '../src/config/balance';
import { createInitialGameState } from '../src/core/state/GameState';
import { createSharedWorld } from '../simulation/full-game/sharedWorld';

it('caps a shared world at six independently charged and settled launches', () => {
  const state = { ...createInitialGameState(balance, 123), cash: 100000 };
  const world = createSharedWorld(state, balance);
  for (let i=0;i<6;i++) expect(world.launch(1)).toBe(true);
  expect(world.launch(1)).toBe(false);
  expect(world.snapshot().state.cash).toBe(97000);
  for(let i=0;i<2000 && world.active;i++) world.step();
  const result = world.snapshot();
  expect(result.pending).toBeNull(); expect(result.settlements).toHaveLength(6);
  expect(result.state.cash).toBe(97000 + result.settlements.reduce((sum,r)=>sum+r.payout,0));
  expect(result.advancedMinutes).toBe(91); // six 15-minute action costs + one shared passive minute
  expect(state.cash).toBe(100000);
  world.destroy();
});

it('blocks launches at Barry and settles the already-paid world before payment', () => {
  const state = { ...createInitialGameState(balance, 123), cash: 100000, clock: { gameDayIndex: 0, minuteOfDay: 539 } };
  const world = createSharedWorld(state, balance);
  expect(world.launch(1)).toBe(true); expect(world.launch(1)).toBe(false);
  expect(world.snapshot().state.totalBarryPaid).toBe(0);
  for(let i=0;i<2000 && world.active;i++) world.step();
  expect(world.snapshot().state.totalBarryPaid).toBeGreaterThan(0);
  expect(world.snapshot().pending).toBeNull(); world.destroy();
});

it('adds active skill time without replacing the shift action cost', async () => {
  const { runFullGame } = await import('../simulation/full-game/runner');
  const policy = { id: 'clock-regression', decide: ({ counters }: import('../simulation/full-game/runner').FullGamePolicyContext): import('../simulation/full-game/runner').FullGameDecision => counters.workShifts === 0 ? { type: 'WORK', jobId: 'courier', level: 1, result: 'SUCCESS' } : { type: 'STOP' } };
  const model = { id: 'unused', resolve() { throw Error('unexpected Drop'); } };
  const original = runFullGame(balance, policy, model, { seed: 123, configHash: 'test' });
  const timed = runFullGame(balance, policy, model, { seed: 123, configHash: 'test', execution: { decisionSeconds: 0, workSeconds: () => 30, plinko() { throw Error('unexpected Drop'); } } });
  expect(timed.counters.gameMinutesAdvanced - original.counters.gameMinutesAdvanced).toBe(10);
  expect(timed.diagnostics.activeSeconds?.work).toBe(30);
});
