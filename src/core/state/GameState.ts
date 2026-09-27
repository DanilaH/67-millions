import type { BalanceConfig } from '../../config/balance.schema';
import { createGameClock, type GameClockState } from '../time/GameClock';

export type TerminalReason = 'BARRY_PAYMENT_FAILED' | 'HEALTH_ZERO';

export interface NeedsState {
  health: number;
  satiety: number;
  energy: number;
  happiness: number;
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
  rngState: seed >>> 0,
  terminalReason: null,
  victory: false,
});

export const restartGame = (
  config: BalanceConfig,
  newSeed: number,
): GameState => createInitialGameState(config, newSeed);
