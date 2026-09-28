import type { BalanceConfig } from '../../config/balance.schema';
import { roundMoney } from '../economy/money';
import type { GameState, InsuranceArmState } from '../state/GameState';

export interface InsuranceResolution {
  naturalPayout: number;
  payout: number;
  naturalLosing: boolean;
  insuranceApplied: boolean;
  insuranceTopUp: number;
  nextLossStreak: number;
  nextArmed: InsuranceArmState | null;
}

export const getInsuranceLevel = (
  config: BalanceConfig,
  level: number,
) => {
  if (level === 0) return null;

  const entry = config.plinko.insurance.find(
    (candidate) => candidate.level === level,
  );
  if (!entry) {
    throw new RangeError(`Unknown Insurance level ${level}`);
  }
  return entry;
};

export const resolveInsuranceAfterDrop = (
  state: GameState,
  insuranceAtCommit: InsuranceArmState | null,
  originalStake: number,
  aggregatePayout: number,
  config: BalanceConfig,
): InsuranceResolution => {
  const naturalPayout = roundMoney(aggregatePayout);
  if (naturalPayout < 0) {
    throw new RangeError('Drop payout cannot be negative');
  }
  if (!Number.isFinite(originalStake) || originalStake <= 0) {
    throw new RangeError('Insurance requires a positive original stake');
  }

  const naturalLosing = naturalPayout < originalStake;
  const floorPayout =
    insuranceAtCommit === null
      ? 0
      : roundMoney(originalStake * insuranceAtCommit.floor);
  const payout = Math.max(naturalPayout, floorPayout);
  const insuranceApplied =
    insuranceAtCommit !== null;
  const insuranceTopUp = payout - naturalPayout;

  if (insuranceAtCommit !== null) {
    return {
      naturalPayout,
      payout,
      naturalLosing,
      insuranceApplied,
      insuranceTopUp,
      nextLossStreak: 0,
      nextArmed: null,
    };
  }

  const level = getInsuranceLevel(
    config,
    state.plinkoInsuranceLevel,
  );

  if (level === null) {
    return {
      naturalPayout,
      payout,
      naturalLosing,
      insuranceApplied,
      insuranceTopUp,
      nextLossStreak: 0,
      nextArmed: null,
    };
  }

  if (!naturalLosing) {
    return {
      naturalPayout,
      payout,
      naturalLosing,
      insuranceApplied,
      insuranceTopUp,
      nextLossStreak: 0,
      nextArmed: null,
    };
  }

  const nextLossStreak =
    state.plinkoInsuranceLossStreak + 1;
  const nextArmed =
    nextLossStreak >= level.lossesNeeded
      ? {
          level: level.level,
          floor: level.floor,
        }
      : null;

  return {
    naturalPayout,
    payout,
    naturalLosing,
    insuranceApplied,
    insuranceTopUp,
    nextLossStreak,
    nextArmed,
  };
};
