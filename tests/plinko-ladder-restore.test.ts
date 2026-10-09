import { expect, it } from 'vitest';
import previousRaw from '../reports/pacing/2026-10-09-ladder/configs/control.json';
import { balance, parseBalanceConfig } from '../src/config/balance';
import { createInitialGameState } from '../src/core/state/GameState';
import { createSaveState, parseSaveState } from '../src/core/save/SaveState';
import { resolvePendingBoardConfig } from '../src/core/plinko-rules/restoreBoardConfig';
import { createSharedWorld } from '../simulation/full-game/sharedWorld';

it('finishes six old 100k stakes after a save reload, then charges the new 30k cap', () => {
  const previous = parseBalanceConfig(previousRaw);
  const initial = { ...createInitialGameState(previous, 67159000), cash: 2_000_000,
    plinkoCapacityLevel: 3, plinkoMaxBetLevel: 6, plinkoCenterLevel: 2, plinkoMidLevel: 3,
    plinkoJackpotLevel: 3, plinkoAmplifierLevel: 5, plinkoReturnLevel: 4,
    plinkoSplitterLevel: 5, plinkoJackpotBiasLevel: 4 };
  const original = createSharedWorld(initial, previous);
  for (let i=0;i<6;i++) {
    expect(original.launch(1)).toBe(true);
    for (let t=0;t<15;t++) original.step();
  }
  const checkpoint = original.snapshot();
  const save = parseSaveState(JSON.parse(JSON.stringify({ ...createSaveState(checkpoint.state), pendingDrop: checkpoint.pending })));
  const restored = createSharedWorld(save.game, resolvePendingBoardConfig(balance, save.pendingDrop), save.pendingDrop);
  try {
    for (let t=0;t<3600 && (original.active || restored.active);t++) { original.step(); restored.step(); }
    expect(original.active).toBe(false);
    expect(restored.active).toBe(false);
    const result = restored.snapshot();
    expect(result.state).toEqual(original.snapshot().state);
    expect(result.settlements.map(s=>s.stake)).toEqual([100_000,100_000,100_000,100_000,100_000,100_000]);
    expect(result.settlements).toEqual(original.snapshot().settlements.map(s=>({...s,tick:s.tick-checkpoint.elapsedTicks})));
    const before = result.state.cash;
    expect(restored.launch(1)).toBe(true);
    expect(restored.snapshot().state.cash).toBe(before-30_000);
  } finally { original.destroy(); restored.destroy(); }
});
