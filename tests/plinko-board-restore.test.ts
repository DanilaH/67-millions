import { describe, expect, it } from 'vitest';
import { balance } from '../src/config/balance';
import legacyPairs from '../src/config/plinko-deflectors-2026-10-02.json';
import { resolvePendingBoardConfig } from '../src/core/plinko-rules/restoreBoardConfig';
import { assertDropBoardCompatible, commitBareDrop, settleAggregateDrop } from '../src/core/plinko-rules/drop';
import { createInitialGameState } from '../src/core/state/GameState';

describe('paid board compatibility after deflector calibration', () => {
  it('finishes old paid drops on their exact old board, without rewriting the save', () => {
    const old = structuredClone(balance);
    old.plinko.jackpotBias.forEach((l,i) => { l.deflectorPairs = structuredClone(legacyPairs[i]!); });
    const state = { ...createInitialGameState(old, 67), plinkoJackpotBiasLevel: 4 };
    const committed = commitBareDrop(state, null, old, 'old-paid', 1);
    const before = JSON.stringify(committed);
    const resolved = resolvePendingBoardConfig(balance, committed.pendingDrop);
    expect(resolved.plinko.jackpotBias).toEqual(old.plinko.jackpotBias);
    expect(() => assertDropBoardCompatible(committed.pendingDrop, resolved, committed.state)).not.toThrow();
    expect(settleAggregateDrop(committed.state, committed.pendingDrop, 1234, resolved).state.cash).toBe(1234);
    expect(JSON.stringify(committed)).toBe(before);
    expect(resolvePendingBoardConfig(balance, null)).toBe(balance);
  });
  it('keeps current boards and rejects unrelated mismatches', () => {
    const state = { ...createInitialGameState(balance, 67), plinkoJackpotBiasLevel: 4 };
    const { pendingDrop } = commitBareDrop(state, null, balance, 'current', 1);
    expect(resolvePendingBoardConfig(balance, pendingDrop)).toBe(balance);
    const corrupt = {...pendingDrop, boardFingerprint: pendingDrop.boardFingerprint + 'bad'};
    expect(() => assertDropBoardCompatible(corrupt, resolvePendingBoardConfig(balance, corrupt))).toThrow('fingerprint');
  });
});
