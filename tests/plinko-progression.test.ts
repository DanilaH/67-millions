import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import { commitBareDrop } from '../src/core/plinko-rules/drop';
import {
  derivePocketMultipliers,
  getMaxBetForLevel,
  getPocketUpgradeLevels,
  purchaseMaxBetUpgrade,
  purchasePocketUpgrade,
  purchaseSpecialUpgrade,
} from '../src/core/plinko-rules/progression';
import { createInitialGameState } from '../src/core/state/GameState';

describe('Plinko derived progression', () => {
  it('derives the bare pocket board unchanged at zero levels', () => {
    const state = createInitialGameState(balance, 1);

    expect(
      derivePocketMultipliers(balance, getPocketUpgradeLevels(state)),
    ).toEqual(balance.plinko.basePockets);
  });

  it('maps configured pocket families symmetrically without changing static 4x pockets', () => {
    const pockets = derivePocketMultipliers(balance, {
      centerLevel: 2,
      midLevel: 1,
      jackpotLevel: 3,
    });

    expect(pockets).toEqual([
      100,
      4,
      1.8,
      1.1,
      0.4,
      0.4,
      1.1,
      1.8,
      4,
      100,
    ]);
  });

  it('uses the strongest active inner effect independent of purchase order', () => {
    const config = structuredClone(balance);
    const state = {
      ...createInitialGameState(config, 1),
      cash: 1_000_000,
    };

    const centerThenMid = purchasePocketUpgrade(
      purchasePocketUpgrade(state, null, config, 'center'),
      null,
      config,
      'mid',
    );
    const midThenCenter = purchasePocketUpgrade(
      purchasePocketUpgrade(state, null, config, 'mid'),
      null,
      config,
      'center',
    );

    expect(getPocketUpgradeLevels(centerThenMid)).toEqual(
      getPocketUpgradeLevels(midThenCenter),
    );
    expect(centerThenMid.cash).toBe(midThenCenter.cash);
    expect(
      derivePocketMultipliers(config, getPocketUpgradeLevels(centerThenMid)),
    ).toEqual(
      derivePocketMultipliers(config, getPocketUpgradeLevels(midThenCenter)),
    );
  });

  it('buys max-bet levels only from configured ladder values', () => {
    const state = {
      ...createInitialGameState(balance, 1),
      cash: 10_000,
    };

    const upgraded = purchaseMaxBetUpgrade(state, null, balance);

    expect(upgraded.plinkoMaxBetLevel).toBe(1);
    expect(upgraded.cash).toBe(9_500);
    expect(getMaxBetForLevel(balance, upgraded.plinkoMaxBetLevel)).toBe(2_500);
  });

  it('buys special upgrades strictly from configured ladders', () => {
    const initial = {
      ...createInitialGameState(balance, 1),
      cash: 100_000,
    };

    const amp = purchaseSpecialUpgrade(
      initial,
      null,
      balance,
      'amplifier',
    );
    const ret = purchaseSpecialUpgrade(
      amp,
      null,
      balance,
      'return',
    );
    const splitter = purchaseSpecialUpgrade(
      ret,
      null,
      balance,
      'splitter',
    );

    expect(amp.plinkoAmplifierLevel).toBe(1);
    expect(ret.plinkoReturnLevel).toBe(1);
    expect(splitter.plinkoSplitterLevel).toBe(1);
    expect(splitter.cash).toBe(
      100_000 -
        balance.plinko.amplifier[0]!.price -
        balance.plinko.return[0]!.price -
        balance.plinko.splitter[0]!.price,
    );
  });

  it('locks board, max-bet and special purchases while a Drop is pending', () => {
    const state = {
      ...createInitialGameState(balance, 1),
      cash: 20_000,
    };
    const committed = commitBareDrop(state, null, balance, 'locked-drop', 1);

    expect(() =>
      purchasePocketUpgrade(
        committed.state,
        committed.pendingDrop,
        balance,
        'center',
      ),
    ).toThrow('pending');

    expect(() =>
      purchaseMaxBetUpgrade(
        committed.state,
        committed.pendingDrop,
        balance,
      ),
    ).toThrow('pending');

    expect(() =>
      purchaseSpecialUpgrade(
        committed.state,
        committed.pendingDrop,
        balance,
        'splitter',
      ),
    ).toThrow('pending');
  });
});
