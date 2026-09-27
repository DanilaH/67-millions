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
  rngState: number;
  terminalReason: TerminalReason | null;
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
  rngState: seed >>> 0,
  terminalReason: null,
});
