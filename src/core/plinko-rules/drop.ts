import type { BalanceConfig } from '../../config/balance.schema';
import { creditCash, debitCash, roundMoney } from '../economy/money';
import type { GameState } from '../state/GameState';
import { applyNeedsDelta } from '../state/mutations';

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

const getMaxBetEntry = (
  config: BalanceConfig,
  level: number,
) => {
  const entry = config.plinko.maxBetLevels.find((item) => item.level === level);
  if (!entry) throw new Error(`Unknown max-bet level ${level}`);
  return entry;
};

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

  const maxBet = getMaxBetEntry(config, state.plinkoMaxBetLevel).maxBet;
  const originalStake = calculateActualBet(state.cash, maxBet, selectedFraction);

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
      committedGameDayIndex: state.clock.gameDayIndex,
      committedMinuteOfDay: state.clock.minuteOfDay,
      remainingActionMinutes: config.time.plinkoDropTimeMinutes,
      rngStateAtCommit: state.rngState,
      boardFingerprint: createBareBoardFingerprint(config),
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
): void => {
  if (pendingDrop.boardFingerprint !== createBareBoardFingerprint(config)) {
    throw new Error(
      'Pending Drop board fingerprint does not match the current runtime board',
    );
  }
};

export const settleBareDrop = (
  state: GameState,
  pendingDrop: PendingDrop,
  pocketIndex: number,
  config: BalanceConfig,
): DropSettlement => {
  const multiplier = config.plinko.basePockets[pocketIndex];
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
