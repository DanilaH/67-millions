import type { BalanceConfig } from '../../config/balance.schema';
import { creditCash, debitCash, roundMoney } from '../economy/money';
import type { GameState } from '../state/GameState';
import { applyNeedsDelta } from '../state/mutations';
import {
  derivePocketMultipliers,
  getMaxBetForLevel,
  getPocketUpgradeLevels,
  type PocketUpgradeLevels,
} from './progression';

export type BetFraction = 0.25 | 0.5 | 1;

export interface DropBallSnapshot {
  ballId: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  angle: number;
  angularVelocity: number;
  currentValue: number;
  lineageId: string;
  splitDepth: number;
  amplifierProcIds: string[];
  returnUsed: boolean;
  blockedSplitterId: string | null;
}

export interface DropPhysicsSnapshot {
  fixedTicksElapsed: number;
  alreadySettledPayout: number;
  balls: DropBallSnapshot[];
}

export interface PendingDrop {
  dropId: string;
  originalStake: number;
  selectedFraction: BetFraction;
  maxBetLevel: number;
  pocketLevelsAtCommit: PocketUpgradeLevels;
  committedGameDayIndex: number;
  committedMinuteOfDay: number;
  remainingActionMinutes: number;
  rngStateAtCommit: number;
  boardFingerprint: string;
  physics: DropPhysicsSnapshot | null;
}

export interface DropSettlement {
  state: GameState;
  payout: number;
  multiplier: number;
  losing: boolean;
}

export const createBareBoardFingerprint = (
  config: BalanceConfig,
): string =>
  JSON.stringify({
    version: 1,
    rows: config.plinko.rows,
    basePockets: config.plinko.basePockets,
    geometry: config.plinko.geometry,
    physics: config.plinko.physicsSeed,
  });

export const createBoardFingerprint = (
  config: BalanceConfig,
  pocketLevels: PocketUpgradeLevels,
): string =>
  JSON.stringify({
    version: 2,
    rows: config.plinko.rows,
    pockets: derivePocketMultipliers(config, pocketLevels),
    pocketLevels,
    geometry: config.plinko.geometry,
    physics: config.plinko.physicsSeed,
  });

export const calculateActualBet = (
  cash: number,
  maxBet: number,
  fraction: BetFraction,
): number => {
  if (cash <= 0) throw new Error('Cannot Drop with zero cash');
  const requested = roundMoney(maxBet * fraction);
  return Math.min(roundMoney(cash), requested);
};

export const commitBareDrop = (
  state: GameState,
  existingPendingDrop: PendingDrop | null,
  config: BalanceConfig,
  dropId: string,
  selectedFraction: BetFraction = state.plinkoSelectedBetFraction,
): { state: GameState; pendingDrop: PendingDrop } => {
  if (!dropId) throw new Error('Drop requires a stable dropId');
  if (existingPendingDrop !== null) throw new Error('A Drop is already pending');
  if (state.terminalReason !== null || state.victory || state.barryInterruptPending) {
    throw new Error('Cannot commit Drop in the current run state');
  }

  const maxBet = getMaxBetForLevel(config, state.plinkoMaxBetLevel);
  const originalStake = calculateActualBet(state.cash, maxBet, selectedFraction);
  const pocketLevelsAtCommit = getPocketUpgradeLevels(state);

  return {
    state: {
      ...state,
      cash: debitCash(state.cash, originalStake),
      plinkoSelectedBetFraction: selectedFraction,
    },
    pendingDrop: {
      dropId,
      originalStake,
      selectedFraction,
      maxBetLevel: state.plinkoMaxBetLevel,
      pocketLevelsAtCommit,
      committedGameDayIndex: state.clock.gameDayIndex,
      committedMinuteOfDay: state.clock.minuteOfDay,
      remainingActionMinutes: config.time.plinkoDropTimeMinutes,
      rngStateAtCommit: state.rngState,
      boardFingerprint: createBoardFingerprint(config, pocketLevelsAtCommit),
      physics: null,
    },
  };
};

export const setDropPhysicsSnapshot = (
  pendingDrop: PendingDrop,
  physics: DropPhysicsSnapshot,
): PendingDrop => ({
  ...pendingDrop,
  physics: {
    ...physics,
    balls: physics.balls.map((ball) => ({
      ...ball,
      amplifierProcIds: [...ball.amplifierProcIds],
    })),
  },
});

export const assertDropBoardCompatible = (
  pendingDrop: PendingDrop,
  config: BalanceConfig,
  state?: GameState,
): void => {
  const expected = createBoardFingerprint(
    config,
    pendingDrop.pocketLevelsAtCommit,
  );
  const zeroLevelLegacy =
    pendingDrop.pocketLevelsAtCommit.centerLevel === 0 &&
    pendingDrop.pocketLevelsAtCommit.midLevel === 0 &&
    pendingDrop.pocketLevelsAtCommit.jackpotLevel === 0 &&
    pendingDrop.boardFingerprint === createBareBoardFingerprint(config);

  if (pendingDrop.boardFingerprint !== expected && !zeroLevelLegacy) {
    throw new Error(
      'Pending Drop board fingerprint does not match the current runtime board',
    );
  }

  if (state) {
    const current = getPocketUpgradeLevels(state);
    if (
      current.centerLevel !== pendingDrop.pocketLevelsAtCommit.centerLevel ||
      current.midLevel !== pendingDrop.pocketLevelsAtCommit.midLevel ||
      current.jackpotLevel !== pendingDrop.pocketLevelsAtCommit.jackpotLevel
    ) {
      throw new Error(
        'Pending Drop upgrade state changed after the Drop was committed',
      );
    }
  }
};

export const settleBareDrop = (
  state: GameState,
  pendingDrop: PendingDrop,
  pocketIndex: number,
  config: BalanceConfig,
): DropSettlement => {
  assertDropBoardCompatible(pendingDrop, config, state);
  const pockets = derivePocketMultipliers(
    config,
    pendingDrop.pocketLevelsAtCommit,
  );
  const multiplier = pockets[pocketIndex];
  if (multiplier === undefined) throw new RangeError('Invalid Plinko pocket index');

  const payout = roundMoney(pendingDrop.originalStake * multiplier);
  const losing = payout < pendingDrop.originalStake;

  let nextState: GameState = {
    ...state,
    cash: creditCash(state.cash, payout),
  };

  if (losing) {
    nextState = applyNeedsDelta(
      nextState,
      { happiness: config.needs.plinkoLosingDropHappiness },
      { min: config.needs.min, max: config.needs.max },
    ).state;
  }

  return { state: nextState, payout, multiplier, losing };
};
