import legacyPhysics from '../src/config/plinko-physics-2026-10-03.json';
import { expect, it } from 'vitest';
import { balance } from '../src/config/balance';
import { createInitialGameState } from '../src/core/state/GameState';
import { createSharedWorld } from '../simulation/full-game/sharedWorld';

it.each([false, true])('caps and independently settles six launches (legacy physics: %s)', legacy => {
  const config = structuredClone(balance);
  if (legacy) config.plinko.physicsSeed = structuredClone(legacyPhysics);
  const state = { ...createInitialGameState(balance, 123), cash: 100000, plinkoCapacityLevel: 3 };
  const world = createSharedWorld(state, config);
  for (let i=0;i<6;i++) expect(world.launch(1)).toBe(true);
  expect(world.launch(1)).toBe(false);
  expect(world.snapshot().state.cash).toBe(97000);
  for(let i=0;i<2000 && world.active;i++) world.step();
  const result = world.snapshot();
  expect(result.pending).toBeNull(); expect(result.settlements).toHaveLength(6);
  expect(result.state.cash).toBe(97000 + result.settlements.reduce((sum,r)=>sum+r.payout,0));
  expect(result.diagnostics.pockets.reduce((sum, n) => sum + n, 0)).toBe(6);
  expect(result.diagnostics.splitterProcs).toBe(0);
  expect(result.advancedMinutes).toBe(6 * 15 + Math.floor(result.elapsedTicks / 180)); // shared passive clock, not per ball
  expect(result.advancedMinutes).toBe(legacy ? 92 : 91); // Same seed: calibrated damping changes flight duration, not clock rules
  expect(state.cash).toBe(100000);
  world.destroy();
});

it('blocks launches at Barry and settles the already-paid world before payment', () => {
  const state = { ...createInitialGameState(balance, 123), cash: 100000, plinkoCapacityLevel: 3, clock: { gameDayIndex: 0, minuteOfDay: 539 } };
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

it('captures an immutable solver checkpoint while its source world keeps running', () => {
  const world = createSharedWorld({ ...createInitialGameState(balance, 123), cash: 100000, plinkoCapacityLevel: 3 }, balance);
  world.launch(1);
  for (let i=0;i<60;i++) world.step();
  const checkpoint = world.snapshot(); const encoded = JSON.stringify(checkpoint);
  for (let i=0;i<120;i++) world.step();
  expect(JSON.stringify(checkpoint)).toBe(encoded);
  world.destroy();
});


it.each([false, true])('replays a shared checkpoint exactly (specials: %s)', special => {
  const initial = { ...createInitialGameState(balance, 67105001), cash: 100000, plinkoCapacityLevel: 3 };
  if (special) Object.assign(initial, { plinkoCenterLevel: 2, plinkoMidLevel: 3, plinkoJackpotLevel: 3, plinkoAmplifierLevel: 5, plinkoReturnLevel: 4, plinkoSplitterLevel: 5, plinkoJackpotBiasLevel: 4 });
  const original = createSharedWorld(initial, balance);
  for (let i=0;i<6;i++) { original.launch(i%2 ? 1 : 0.25); for(let tick=0;tick<15;tick++) original.step(); }
  const checkpoint = JSON.parse(JSON.stringify(original.snapshot()));
  const restored = createSharedWorld(checkpoint.state, balance, checkpoint.pending);
  for(let tick=0;tick<3600 && (original.active || restored.active);tick++) {
    original.step(); restored.step();
    expect(restored.snapshot().pending).toEqual(original.snapshot().pending);
    expect(restored.snapshot().state).toEqual(original.snapshot().state);
  }
  expect(original.active).toBe(false);
  original.destroy(); restored.destroy();
});
