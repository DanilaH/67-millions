import type { BalanceConfig } from '../../config/balance.schema';
import type { DropBallState } from './drop';
import {
  getAmplifierUpgrade,
  getReturnUpgrade,
  getSplitterUpgrade,
  type SpecialUpgradeLevels,
} from './progression';
import {
  getAmplifierPins,
  getReturnPins,
  getSplitterPins,
  type AmplifierPinCount,
} from './specialPinLayout';

export interface ActiveAmplifierPins {
  pegIds: string[];
  multiplier: number;
}

export interface ActiveReturnPins {
  pegIds: string[];
}

export interface ActiveSplitterPins {
  pegIds: string[];
  childValue: number;
}

export interface ActiveSpecialPins {
  amplifier: ActiveAmplifierPins | null;
  return: ActiveReturnPins | null;
  splitter: ActiveSplitterPins | null;
}

const toAmplifierPinCount = (value: number): AmplifierPinCount => {
  if (value === 1 || value === 2 || value === 3) return value;
  throw new RangeError(`Unsupported Amplifier physical pin count ${value}`);
};

export const deriveActiveSpecialPins = (
  config: BalanceConfig,
  levels: SpecialUpgradeLevels,
): ActiveSpecialPins => {
  const amplifier = getAmplifierUpgrade(config, levels.amplifierLevel);
  const returnUpgrade = getReturnUpgrade(config, levels.returnLevel);
  const splitter = getSplitterUpgrade(config, levels.splitterLevel);

  return {
    amplifier:
      amplifier === null
        ? null
        : {
            pegIds: getAmplifierPins(
              config,
              toAmplifierPinCount(amplifier.count),
            ).map((peg) => peg.id),
            multiplier: amplifier.multiplier,
          },
    return:
      returnUpgrade === null
        ? null
        : {
            pegIds: getReturnPins(config, returnUpgrade.level).map(
              (peg) => peg.id,
            ),
          },
    splitter:
      splitter === null
        ? null
        : {
            pegIds: getSplitterPins(config).map((peg) => peg.id),
            childValue: splitter.childValue,
          },
  };
};

export const createRootBallState = (dropId: string): DropBallState => ({
  ballId: `${dropId}:root`,
  currentValue: 1,
  lineageId: `${dropId}:root`,
  splitDepth: 0,
  amplifierProcIds: [],
  returnUsed: false,
  blockedSplitterId: null,
});

export const canAmplifyAt = (
  ball: DropBallState,
  amplifierId: string,
): boolean => !ball.amplifierProcIds.includes(amplifierId);

export const markAmplifierProc = (
  ball: DropBallState,
  amplifierId: string,
  multiplier: number,
  applyValue: boolean,
): DropBallState => {
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new RangeError('Amplifier multiplier must be positive and finite');
  }

  const amplifierProcIds = ball.amplifierProcIds.includes(amplifierId)
    ? [...ball.amplifierProcIds]
    : [...ball.amplifierProcIds, amplifierId];

  return {
    ...ball,
    currentValue: applyValue ? ball.currentValue * multiplier : ball.currentValue,
    amplifierProcIds,
  };
};

export const canReturnLineage = (ball: DropBallState): boolean =>
  !ball.returnUsed;

export const markReturnUsed = (ball: DropBallState): DropBallState => ({
  ...ball,
  returnUsed: true,
});

export const clearSplitterBlockAfterPeg = (
  ball: DropBallState,
  pegId: string,
): DropBallState =>
  ball.blockedSplitterId !== null && ball.blockedSplitterId !== pegId
    ? { ...ball, blockedSplitterId: null }
    : ball;

export const canSplitAt = (
  ball: DropBallState,
  splitterId: string,
  activeBallCount: number,
  config: BalanceConfig,
): boolean =>
  ball.blockedSplitterId !== splitterId &&
  ball.splitDepth < config.plinko.maxSplitDepth &&
  activeBallCount + 1 <= config.plinko.maxActiveBalls;

export const createSplitChildren = (
  parent: DropBallState,
  splitterId: string,
  childValue: number,
): [DropBallState, DropBallState] => {
  if (!Number.isFinite(childValue) || childValue <= 0) {
    throw new RangeError('Splitter childValue must be positive and finite');
  }

  const makeChild = (index: 0 | 1): DropBallState => ({
    ballId: `${parent.ballId}.${index}`,
    currentValue: parent.currentValue * childValue,
    lineageId: parent.lineageId,
    splitDepth: parent.splitDepth + 1,
    amplifierProcIds: [...parent.amplifierProcIds],
    returnUsed: parent.returnUsed,
    blockedSplitterId: splitterId,
  });

  return [makeChild(0), makeChild(1)];
};
