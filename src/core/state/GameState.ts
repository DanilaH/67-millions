import type { BalanceConfig } from '../../config/balance.schema';
import { createGameClock, type GameClockState } from '../time/GameClock';

export type TerminalReason = 'BARRY_PAYMENT_FAILED' | 'HEALTH_ZERO';

export interface NeedsState {
  health: number;
  satiety: number;
  energy: number;
  happiness: number;
}

export interface JobLevelsState {
  dishes: number;
  trash: number;
  courier: number;
}

export interface StatusState {
  SMELLY: boolean;
}

export interface InsuranceArmState {
  level: number;
  floor: number;
}

export interface GameState {
  cash: number;
  mainDebt: number;
  clock: GameClockState;
  needs: NeedsState;
  barryPaymentIndex: number;
  barryInterruptPending: boolean;
  totalBarryPaid: number;
  sleepMinutesCurrentGameDay: number;
  workPayoutMultiplier: number;
  jobLevels: JobLevelsState;
  dumpsterSearchStreak: number;
  statuses: StatusState;
  pendingEventId: string | null;
  eventsResolvedThisGameDay: number;
  lastResolvedEventId: string | null;
  plinkoSelectedBetFraction: 0.25 | 0.5 | 1;
  plinkoMaxBetLevel: number;
  plinkoCenterLevel: number;
  plinkoMidLevel: number;
  plinkoJackpotLevel: number;
  plinkoAmplifierLevel: number;
  plinkoReturnLevel: number;
  plinkoSplitterLevel: number;
  plinkoJackpotBiasLevel: number;
  plinkoInsuranceLevel: number;
  plinkoInsuranceLossStreak: number;
  plinkoInsuranceArmed: InsuranceArmState | null;
  rngState: number;
  terminalReason: TerminalReason | null;
  victory: boolean;
}

export const createInitialGameState = (
  config: BalanceConfig,
  seed: number,
): GameState => ({
  cash: config.game.startCash,
  mainDebt: config.game.mainDebt,
  clock: createGameClock(config.game.startTime),
  needs: {
    health: config.game.startHealth,
    satiety: config.game.startSatiety,
    energy: config.game.startEnergy,
    happiness: config.game.startHappiness,
  },
  barryPaymentIndex: 0,
  barryInterruptPending: false,
  totalBarryPaid: 0,
  sleepMinutesCurrentGameDay: 0,
  workPayoutMultiplier: 1,
  jobLevels: {
    dishes: 1,
    trash: 1,
    courier: 1,
  },
  dumpsterSearchStreak: 0,
  statuses: { SMELLY: false },
  pendingEventId: null,
  eventsResolvedThisGameDay: 0,
  lastResolvedEventId: null,
  plinkoSelectedBetFraction: 1,
  plinkoMaxBetLevel: 0,
  plinkoCenterLevel: 0,
  plinkoMidLevel: 0,
  plinkoJackpotLevel: 0,
  plinkoAmplifierLevel: 0,
  plinkoReturnLevel: 0,
  plinkoSplitterLevel: 0,
  plinkoJackpotBiasLevel: 0,
  plinkoInsuranceLevel: 0,
  plinkoInsuranceLossStreak: 0,
  plinkoInsuranceArmed: null,
  rngState: seed >>> 0,
  terminalReason: null,
  victory: false,
});

export const restartGame = (
  config: BalanceConfig,
  newSeed: number,
): GameState => createInitialGameState(config, newSeed);
