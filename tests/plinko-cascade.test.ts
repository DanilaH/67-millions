import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import {
  canAmplifyAt,
  canReturnLineage,
  canSplitAt,
  clearSplitterBlockAfterPeg,
  createRootBallState,
  createSplitChildren,
  deriveActiveSpecialPins,
  markAmplifierProc,
  markReturnUsed,
} from '../src/core/plinko-rules/cascade';

describe('Plinko special-pin lineage rules', () => {
  it('derives active pins only from committed special levels', () => {
    const active = deriveActiveSpecialPins(balance, {
      amplifierLevel: 1,
      returnLevel: 1,
      splitterLevel: 1,
      jackpotBiasLevel: 0,
    });

    expect(active.amplifier?.pegIds).toEqual(['r6c3']);
    expect(active.amplifier?.multiplier).toBe(1.25);
    expect(active.return?.pegIds).toEqual(['r8c1', 'r8c7']);
    expect(active.splitter?.pegIds).toEqual(['r4c2']);
    expect(active.splitter?.childValue).toBe(0.7);
  });

  it('allows each physical Amplifier once per lineage state and multiplies only when requested', () => {
    const root = createRootBallState('drop');
    expect(canAmplifyAt(root, 'r6c3')).toBe(true);

    const hitting = markAmplifierProc(root, 'r6c3', 1.25, true);
    const sibling = markAmplifierProc(root, 'r6c3', 1.25, false);

    expect(hitting.currentValue).toBe(1.25);
    expect(sibling.currentValue).toBe(1);
    expect(hitting.amplifierProcIds).toEqual(['r6c3']);
    expect(sibling.amplifierProcIds).toEqual(['r6c3']);
    expect(canAmplifyAt(hitting, 'r6c3')).toBe(false);
    expect(canAmplifyAt(sibling, 'r6c3')).toBe(false);
  });

  it('preserves 100% value on Return and permits it only once per lineage state', () => {
    const amplified = markAmplifierProc(
      createRootBallState('drop'),
      'r6c3',
      1.4,
      true,
    );

    expect(canReturnLineage(amplified)).toBe(true);
    const returned = markReturnUsed(amplified);

    expect(returned.currentValue).toBe(1.4);
    expect(returned.returnUsed).toBe(true);
    expect(canReturnLineage(returned)).toBe(false);
  });

  it('creates two value-scaled children that inherit lineage guards and block immediate splitter re-proc', () => {
    const parent = {
      ...markReturnUsed(
        markAmplifierProc(
          createRootBallState('drop'),
          'amp-a',
          1.25,
          true,
        ),
      ),
      splitDepth: 1,
    };

    const [left, right] = createSplitChildren(parent, 'r8c4', 0.5);

    expect(left.currentValue).toBe(0.625);
    expect(right.currentValue).toBe(0.625);
    expect(left.lineageId).toBe(parent.lineageId);
    expect(right.lineageId).toBe(parent.lineageId);
    expect(left.splitDepth).toBe(2);
    expect(right.splitDepth).toBe(2);
    expect(left.amplifierProcIds).toEqual(['amp-a']);
    expect(left.returnUsed).toBe(true);
    expect(left.blockedSplitterId).toBe('r8c4');

    expect(canSplitAt(left, 'r8c4', 2, balance)).toBe(false);
  });

  it('clears the immediate splitter block after another peg but still enforces depth and active-ball cap', () => {
    const root = createRootBallState('drop');
    const [child] = createSplitChildren(root, 'r8c4', 0.48);

    const cleared = clearSplitterBlockAfterPeg(child, 'r7c3');
    expect(cleared.blockedSplitterId).toBeNull();

    expect(
      canSplitAt(
        { ...cleared, splitDepth: balance.plinko.maxSplitDepth },
        'r8c4',
        1,
        balance,
      ),
    ).toBe(false);

    expect(
      canSplitAt(
        { ...cleared, splitDepth: 1 },
        'r8c4',
        balance.plinko.maxActiveBalls,
        balance,
      ),
    ).toBe(false);

    expect(
      canSplitAt(
        { ...cleared, splitDepth: 1 },
        'r8c4',
        balance.plinko.maxActiveBalls - 1,
        balance,
      ),
    ).toBe(true);
  });
});
