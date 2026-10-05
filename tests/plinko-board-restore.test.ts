import { createSharedWorld } from '../simulation/full-game/sharedWorld';
import { describe, expect, it } from 'vitest';
import { balance } from '../src/config/balance';
import legacyPhysics from '../src/config/plinko-physics-2026-10-03.json';
import legacyPairs from '../src/config/plinko-deflectors-2026-10-02.json';
import { resolvePendingBoardConfig } from '../src/core/plinko-rules/restoreBoardConfig';
import { assertDropBoardCompatible, commitBareDrop, settleAggregateDrop } from '../src/core/plinko-rules/drop';
import { createInitialGameState } from '../src/core/state/GameState';

describe('paid board compatibility after deflector calibration', () => {
  it.each([false, true])('finishes old physics and historical deflectors (%s) without rewriting the save', olderDeflectors => {
    const old = structuredClone(balance);
    old.plinko.physicsSeed = structuredClone(legacyPhysics);
    if (olderDeflectors) old.plinko.jackpotBias.forEach((l,i) => { l.deflectorPairs = structuredClone(legacyPairs[i]!); });
    const state = { ...createInitialGameState(old, 67), plinkoJackpotBiasLevel: 4 };
    const committed = commitBareDrop(state, null, old, 'old-paid', 1);
    const before = JSON.stringify(committed);
    const resolved = resolvePendingBoardConfig(balance, committed.pendingDrop);
    expect(resolved.plinko.physicsSeed).toEqual(legacyPhysics);
    expect(resolved.plinko.jackpotBias).toEqual(old.plinko.jackpotBias);
    expect(() => assertDropBoardCompatible(committed.pendingDrop, resolved, committed.state)).not.toThrow();
    expect(settleAggregateDrop(committed.state, committed.pendingDrop, 1234, resolved).state.cash).toBe(1234);
    expect(JSON.stringify(committed)).toBe(before);
    expect(resolvePendingBoardConfig(balance, null)).toBe(balance);
  });
  it.each([false, true])('continues six paid old-physics cascades exactly (old deflectors: %s)', olderDeflectors => {
    const old = structuredClone(balance);
    old.plinko.physicsSeed = structuredClone(legacyPhysics);
    if (olderDeflectors) old.plinko.jackpotBias.forEach((l,i) => { l.deflectorPairs = structuredClone(legacyPairs[i]!); });
    const original = createSharedWorld({ ...createInitialGameState(old, 67105001), cash: 100000,
      plinkoAmplifierLevel: 5, plinkoReturnLevel: 4, plinkoSplitterLevel: 5, plinkoJackpotBiasLevel: 4 }, old);
    for (let i=0;i<6;i++) { expect(original.launch(1)).toBe(true); for(let t=0;t<15;t++) original.step(); }
    const checkpoint = original.snapshot();
    const restored = createSharedWorld(checkpoint.state, resolvePendingBoardConfig(balance, checkpoint.pending), checkpoint.pending);
    try {
      for(let t=0;t<3600 && (original.active || restored.active);t++) { original.step(); restored.step(); }
      expect(original.active).toBe(false);
      expect(restored.active).toBe(false);
      expect(restored.snapshot().state).toEqual(original.snapshot().state);
      expect(restored.snapshot().settlements).toEqual(original.snapshot().settlements.map(r => ({...r, tick:r.tick-checkpoint.elapsedTicks})));
    } finally { original.destroy(); restored.destroy(); }
  });
  it('keeps current boards and rejects unrelated mismatches', () => {
    const state = { ...createInitialGameState(balance, 67), plinkoJackpotBiasLevel: 4 };
    const { pendingDrop } = commitBareDrop(state, null, balance, 'current', 1);
    expect(resolvePendingBoardConfig(balance, pendingDrop)).toBe(balance);
    const corrupt = {...pendingDrop, boardFingerprint: pendingDrop.boardFingerprint + 'bad'};
    expect(() => assertDropBoardCompatible(corrupt, resolvePendingBoardConfig(balance, corrupt))).toThrow('fingerprint');
  });
});
