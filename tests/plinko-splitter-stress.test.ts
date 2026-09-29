import { describe, expect, it } from 'vitest';

import type { BalanceConfig } from '../src/config/balance.schema';
import { balance } from '../src/config/balance';
import {
  canSplitAt,
  clearSplitterBlockAfterPeg,
  createRootBallState,
  createSplitChildren,
} from '../src/core/plinko-rules/cascade';
import type { DropBallState } from '../src/core/plinko-rules/drop';

const stressConfig: BalanceConfig = {
  ...balance,
  plinko: {
    ...balance.plinko,
    maxSplitDepth: 64,
  },
};

describe('Splitter 24-ball stress cap', () => {
  it('can reach exactly the production active-ball cap but never exceed it', () => {
    const active: DropBallState[] = [
      createRootBallState('stress-cap'),
    ];
    let splitIndex = 0;

    while (active.length < stressConfig.plinko.maxActiveBalls) {
      const candidateIndex = active.findIndex((ball) =>
        canSplitAt(
          ball,
          `stress-splitter-${splitIndex}`,
          active.length,
          stressConfig,
        ),
      );

      expect(candidateIndex).toBeGreaterThanOrEqual(0);

      const parent = active[candidateIndex]!;
      const splitterId = `stress-splitter-${splitIndex}`;
      const [left, right] = createSplitChildren(
        parent,
        splitterId,
        0.5,
      );

      active.splice(
        candidateIndex,
        1,
        clearSplitterBlockAfterPeg(left, 'stress-clear'),
        clearSplitterBlockAfterPeg(right, 'stress-clear'),
      );
      splitIndex += 1;
    }

    expect(active).toHaveLength(balance.plinko.maxActiveBalls);
    expect(balance.plinko.maxActiveBalls).toBe(24);

    for (const ball of active) {
      expect(
        canSplitAt(
          ball,
          'one-more-splitter',
          active.length,
          stressConfig,
        ),
      ).toBe(false);
    }
  });

  it('production split depth remains unchanged outside the stress harness', () => {
    expect(balance.plinko.maxSplitDepth).toBe(2);
    expect(stressConfig.plinko.maxSplitDepth).toBe(64);
  });
});
