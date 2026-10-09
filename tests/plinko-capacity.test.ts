import { expect, it } from 'vitest';
import { balance } from '../src/config/balance';
import { createInitialGameState } from '../src/core/state/GameState';
import { getLaunchCapacity, purchaseCapacityUpgrade } from '../src/core/plinko-rules/progression';
import { createSaveState } from '../src/core/save/SaveState';
import { migrateSaveState } from '../src/core/save/migrations';
import { createSharedWorld } from '../simulation/full-game/sharedWorld';
import { commitBareDrop } from '../src/core/plinko-rules/drop';

it.each([[0, 2], [1, 3], [2, 4], [3, 6]])('enforces capacity level %s in the shared paid world', (level, capacity) => {
  const initial = { ...createInitialGameState(balance, 123), cash: 100000, plinkoCapacityLevel: level! };
  const world = createSharedWorld(initial, balance);
  expect(getLaunchCapacity(balance, initial)).toBe(capacity);
  for (let i = 0; i < capacity!; i++) expect(world.launch(1)).toBe(true);
  const before = world.snapshot();
  expect(world.launch(1)).toBe(false);
  expect(world.snapshot().state.cash).toBe(100000 - capacity! * 500);
  expect(world.snapshot().pending).toEqual(before.pending);
  world.destroy();
});

it('buys and persists 3/4/6 places at the advertised prices', () => {
  let state = { ...createInitialGameState(balance, 123), cash: 2000000 };
  expect(getLaunchCapacity(balance, state)).toBe(2);
  for (const [price, capacity] of [[5000, 3], [25000, 4], [300000, 6]]) {
    const before = state;
    state = purchaseCapacityUpgrade(state, null, balance);
    expect(state.cash).toBe(before.cash - price!);
    state = migrateSaveState(JSON.parse(JSON.stringify(createSaveState(state)))).game;
    expect(getLaunchCapacity(balance, state)).toBe(capacity);
  }
  expect(() => purchaseCapacityUpgrade(state, null, balance)).toThrow('maxed');
});

it('blocks purchases without cash, while balls fly, at Barry and after victory', () => {
  const initial = createInitialGameState(balance, 123);
  expect(() => purchaseCapacityUpgrade(initial, null, balance)).toThrow();
  const rich = { ...initial, cash: 100000 };
  const pending = commitBareDrop(rich, null, balance, 'capacity-lock').pendingDrop;
  expect(() => purchaseCapacityUpgrade(rich, pending, balance)).toThrow('pending');
  expect(() => purchaseCapacityUpgrade({ ...rich, barryInterruptPending: true }, null, balance)).toThrow('Barry');
  expect(() => purchaseCapacityUpgrade({ ...rich, victory: true }, null, balance)).toThrow('ended');
  expect(rich.cash).toBe(100000);
});

it('preserves new level zero but grants legacy saves their existing six places', () => {
  const current = createSaveState(createInitialGameState(balance, 123));
  expect(migrateSaveState(current).game.plinkoCapacityLevel).toBe(0);
  const legacy = JSON.parse(JSON.stringify(current));
  delete legacy.game.plinkoCapacityLevel;
  for (const version of [13, 14, 15]) {
    legacy.version = version;
    expect(getLaunchCapacity(balance, migrateSaveState(legacy).game)).toBe(6);
  }
});
