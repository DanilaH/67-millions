import type { BalanceConfig } from '../../config/balance.schema';
import { creditCash, debitCash, roundMoney } from '../economy/money';
import type { GameState, InsuranceArmState } from '../state/GameState';
import { applyNeedsDelta } from '../state/mutations';
import { deriveJackpotBiasGeometry } from './jackpotBias';
import { resolveInsuranceAfterDrop } from './insurance';
import {
  derivePocketMultipliers,
  getMaxBetForLevel,
  getPocketUpgradeLevels,
  getSpecialUpgradeLevels,
  type PocketUpgradeLevels,
  type SpecialUpgradeLevels,
} from './progression';

export type BetFraction = 0.25 | 0.5 | 1;

export interface DropBallState {
  ballId: string;
  currentValue: number;
  lineageId: string;
  splitDepth: number;
  amplifierProcIds: string[];
  returnUsed: boolean;
  blockedSplitterId: string | null;
}

export interface DropBallSnapshot extends DropBallState {
  watchdogStationaryTicks: number;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  angle: number;
  angularVelocity: number;
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
  specialLevelsAtCommit: SpecialUpgradeLevels;
  insuranceAtCommit: InsuranceArmState | null;
  committedGameDayIndex: number;
  committedMinuteOfDay: number;
  remainingActionMinutes: number;
  rngStateAtCommit: number;
  boardFingerprint: string;
  physics: DropPhysicsSnapshot | null;
}

export interface DropSettlement {
  state: GameState;
  naturalPayout: number;
  naturalMultiplier: number;
  payout: number;
  multiplier: number;
  losing: boolean;
  insuranceApplied: boolean;
  insuranceTopUp: number;
}

const isZeroPocketLevels = (levels: PocketUpgradeLevels): boolean =>
  levels.centerLevel === 0 &&
  levels.midLevel === 0 &&
  levels.jackpotLevel === 0;

const isZeroSpecialLevels = (levels: SpecialUpgradeLevels): boolean =>
  levels.amplifierLevel === 0 &&
  levels.returnLevel === 0 &&
  levels.splitterLevel === 0 &&
  levels.jackpotBiasLevel === 0;

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

export const createPocketBoardFingerprintV2 = (
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

export const createSpecialBoardFingerprintV3 = (
  config: BalanceConfig,
  pocketLevels: PocketUpgradeLevels,
  specialLevels: Omit<SpecialUpgradeLevels, 'jackpotBiasLevel'>,
): string =>
  JSON.stringify({
    version: 3,
    rows: config.plinko.rows,
    pockets: derivePocketMultipliers(config, pocketLevels),
    pocketLevels,
    specialLevels,
    specialPinLayoutId: config.plinko.specialPinLayout.id,
    splitterPhysics: config.plinko.splitterPhysics,
    returnPhysics: config.plinko.returnPhysics,
    stuckWatchdog: config.plinko.stuckWatchdog,
    ballBallCollisions: config.plinko.ballBallCollisions,
    geometry: config.plinko.geometry,
    physics: config.plinko.physicsSeed,
  });

export const createBoardFingerprint = (
  config: BalanceConfig,
  pocketLevels: PocketUpgradeLevels,
  specialLevels: SpecialUpgradeLevels,
): string =>
  JSON.stringify({
    version: 4,
    rows: config.plinko.rows,
    pockets: derivePocketMultipliers(config, pocketLevels),
    pocketLevels,
    specialLevels,
    specialPinLayoutId: config.plinko.specialPinLayout.id,
    jackpotBiasGeometry: deriveJackpotBiasGeometry(
      config,
      specialLevels.jackpotBiasLevel,
    ),
    splitterPhysics: config.plinko.splitterPhysics,
    returnPhysics: config.plinko.returnPhysics,
    stuckWatchdog: config.plinko.stuckWatchdog,
    ballBallCollisions: config.plinko.ballBallCollisions,
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
  const specialLevelsAtCommit = getSpecialUpgradeLevels(state);
  const insuranceAtCommit =
    state.plinkoInsuranceArmed === null
      ? null
      : { ...state.plinkoInsuranceArmed };

  return {
    state: {
      ...state,
      cash: debitCash(state.cash, originalStake),
      plinkoSelectedBetFraction: selectedFraction,
      plinkoInsuranceArmed: null,
    },
    pendingDrop: {
      dropId,
      originalStake,
      selectedFraction,
      maxBetLevel: state.plinkoMaxBetLevel,
      pocketLevelsAtCommit,
      specialLevelsAtCommit,
      insuranceAtCommit,
      committedGameDayIndex: state.clock.gameDayIndex,
      committedMinuteOfDay: state.clock.minuteOfDay,
      remainingActionMinutes: config.time.plinkoDropTimeMinutes,
      rngStateAtCommit: state.rngState,
      boardFingerprint: createBoardFingerprint(
        config,
        pocketLevelsAtCommit,
        specialLevelsAtCommit,
      ),
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
    pendingDrop.specialLevelsAtCommit,
  );

  const legacyBareV1 =
    isZeroPocketLevels(pendingDrop.pocketLevelsAtCommit) &&
    isZeroSpecialLevels(pendingDrop.specialLevelsAtCommit) &&
    pendingDrop.boardFingerprint === createBareBoardFingerprint(config);

  const legacyPocketV2 =
    isZeroSpecialLevels(pendingDrop.specialLevelsAtCommit) &&
    pendingDrop.boardFingerprint ===
      createPocketBoardFingerprintV2(config, pendingDrop.pocketLevelsAtCommit);

  const legacyBiasV3 =
    pendingDrop.specialLevelsAtCommit.jackpotBiasLevel === 0 &&
    pendingDrop.boardFingerprint ===
      createSpecialBoardFingerprintV3(
        config,
        pendingDrop.pocketLevelsAtCommit,
        {
          amplifierLevel: pendingDrop.specialLevelsAtCommit.amplifierLevel,
          returnLevel: pendingDrop.specialLevelsAtCommit.returnLevel,
          splitterLevel: pendingDrop.specialLevelsAtCommit.splitterLevel,
        },
      );

  if (
    pendingDrop.boardFingerprint !== expected &&
    !legacyBareV1 &&
    !legacyPocketV2 &&
    !legacyBiasV3
  ) {
    throw new Error(
      'Pending Drop board fingerprint does not match the current runtime board',
    );
  }

  if (state) {
    const currentPocket = getPocketUpgradeLevels(state);
    const currentSpecial = getSpecialUpgradeLevels(state);

    if (
      currentPocket.centerLevel !== pendingDrop.pocketLevelsAtCommit.centerLevel ||
      currentPocket.midLevel !== pendingDrop.pocketLevelsAtCommit.midLevel ||
      currentPocket.jackpotLevel !== pendingDrop.pocketLevelsAtCommit.jackpotLevel ||
      currentSpecial.amplifierLevel !== pendingDrop.specialLevelsAtCommit.amplifierLevel ||
      currentSpecial.returnLevel !== pendingDrop.specialLevelsAtCommit.returnLevel ||
      currentSpecial.splitterLevel !== pendingDrop.specialLevelsAtCommit.splitterLevel ||
      currentSpecial.jackpotBiasLevel !== pendingDrop.specialLevelsAtCommit.jackpotBiasLevel
    ) {
      throw new Error(
        'Pending Drop upgrade state changed after the Drop was committed',
      );
    }
  }
};

export const calculateBallPocketPayout = (
  pendingDrop: PendingDrop,
  currentValue: number,
  pocketIndex: number,
  config: BalanceConfig,
): number => {
  if (!Number.isFinite(currentValue) || currentValue <= 0) {
    throw new RangeError('Ball currentValue must be positive and finite');
  }

  const pockets = derivePocketMultipliers(
    config,
    pendingDrop.pocketLevelsAtCommit,
  );
  const pocketMultiplier = pockets[pocketIndex];
  if (pocketMultiplier === undefined) {
    throw new RangeError('Invalid Plinko pocket index');
  }

  return roundMoney(
    pendingDrop.originalStake * currentValue * pocketMultiplier,
  );
};

export const settleAggregateDrop = (
  state: GameState,
  pendingDrop: PendingDrop,
  payout: number,
  config: BalanceConfig,
): DropSettlement => {
  assertDropBoardCompatible(pendingDrop, config, state);

  const insurance = resolveInsuranceAfterDrop(
    state,
    pendingDrop.insuranceAtCommit,
    pendingDrop.originalStake,
    payout,
    config,
  );

  const naturalMultiplier =
    insurance.naturalPayout / pendingDrop.originalStake;
  const multiplier =
    insurance.payout / pendingDrop.originalStake;

  let nextState: GameState = {
    ...state,
    cash: creditCash(state.cash, insurance.payout),
    plinkoInsuranceLossStreak: insurance.nextLossStreak,
    plinkoInsuranceArmed: insurance.nextArmed,
  };

  if (insurance.naturalLosing) {
    nextState = applyNeedsDelta(
      nextState,
      { happiness: config.needs.plinkoLosingDropHappiness },
      { min: config.needs.min, max: config.needs.max },
    ).state;
  }

  return {
    state: nextState,
    naturalPayout: insurance.naturalPayout,
    naturalMultiplier,
    payout: insurance.payout,
    multiplier,
    losing: insurance.naturalLosing,
    insuranceApplied: insurance.insuranceApplied,
    insuranceTopUp: insurance.insuranceTopUp,
  };
};

export const settleBareDrop = (
  state: GameState,
  pendingDrop: PendingDrop,
  pocketIndex: number,
  config: BalanceConfig,
): DropSettlement =>
  settleAggregateDrop(
    state,
    pendingDrop,
    calculateBallPocketPayout(pendingDrop, 1, pocketIndex, config),
    config,
  );
