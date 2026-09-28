import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import {
  getAmplifierPins,
  getReturnPins,
  getSplitterPins,
  isMirrorSymmetricPinSet,
} from '../src/core/plinko-rules/specialPinLayout';

describe('BOARD_LAYOUT_V0', () => {
  it('resolves Amplifier count sets with exact configured cardinality and symmetry', () => {
    for (const count of [1, 2, 3] as const) {
      const pins = getAmplifierPins(balance, count);
      expect(pins).toHaveLength(count);
      expect(isMirrorSymmetricPinSet(pins)).toBe(true);
    }
  });

  it('resolves every Return level as a mirrored physical pair', () => {
    for (const level of balance.plinko.return) {
      const pins = getReturnPins(balance, level.level);
      expect(pins).toHaveLength(2);
      expect(isMirrorSymmetricPinSet(pins)).toBe(true);
    }
  });

  it('uses a symmetric Splitter seed slot and keeps max-state systems disjoint', () => {
    const amp = getAmplifierPins(balance, 3);
    const ret = getReturnPins(
      balance,
      balance.plinko.return.at(-1)!.level,
    );
    const splitter = getSplitterPins(balance);

    expect(isMirrorSymmetricPinSet(splitter)).toBe(true);

    const ids = [...amp, ...ret, ...splitter].map((pin) => pin.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps Return bare hit-rate seeds monotonic by level', () => {
    const rates = balance.plinko.specialPinLayout.returnByLevel.map(
      (entry) => entry.measuredBareHitRate,
    );

    expect(rates).toEqual([...rates].sort((a, b) => a - b));
  });
});
