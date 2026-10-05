import { expect, it } from 'vitest';
import { balance, parseBalanceConfig } from '../src/config/balance';
import oldConfig from '../reports/pacing/2026-10-05-economy/baseline-config.json';
import { createInitialGameState } from '../src/core/state/GameState';
import { createSharedWorld } from '../simulation/full-game/sharedWorld';
import { resolvePendingBoardConfig } from '../src/core/plinko-rules/restoreBoardConfig';

it('keeps the original paid high-limit stake and payout across an economy update', () => {
  const old = parseBalanceConfig(oldConfig);
  const initial = { ...createInitialGameState(old, 67105001), cash: 50_000_000,
    plinkoMaxBetLevel: 6, plinkoCenterLevel: 2, plinkoMidLevel: 3,
    plinkoJackpotLevel: 3, plinkoAmplifierLevel: 5, plinkoReturnLevel: 4,
    plinkoSplitterLevel: 5, plinkoJackpotBiasLevel: 4 };
  const original = createSharedWorld(initial, old);
  expect(original.launch(.5)).toBe(true);
  for(let i=0;i<150;i++) original.step();
  const checkpoint = original.snapshot();
  expect(checkpoint.pending?.originalStake).toBe(3_906_250);
  const current = resolvePendingBoardConfig(balance, checkpoint.pending);
  expect(current).toBe(balance); // Prices/limits do not change the physical fingerprint.
  const restored = createSharedWorld(checkpoint.state, current, checkpoint.pending);
  try {
    for(let i=0;i<3600 && (original.active || restored.active);i++) { original.step(); restored.step(); }
    expect(restored.active).toBe(false);
    expect(original.active).toBe(false);
    expect(restored.snapshot().state).toEqual(original.snapshot().state);
    expect(restored.snapshot().settlements.map(s=>[s.stake,s.payout]))
      .toEqual(original.snapshot().settlements.map(s=>[s.stake,s.payout]));
    expect(restored.launch(.5)).toBe(true);
    expect(restored.snapshot().pending?.originalStake).toBe(balance.plinko.maxBetLevels[6]!.maxBet/2);
  } finally { original.destroy(); restored.destroy(); }
});
