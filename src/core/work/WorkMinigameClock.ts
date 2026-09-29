import type { BalanceConfig } from '../../config/balance.schema';
import type { GameState } from '../state/GameState';
import { ActiveTimeAccumulator } from '../time/ActiveTimeAccumulator';
import { advanceRunTime } from '../time/runTime';

export interface WorkMinigameClockAdvance {
  state: GameState;
  advancedMinutes: number;
  interruptedByBarry: boolean;
  terminal: boolean;
}

export class WorkMinigameClock {
  private readonly accumulator: ActiveTimeAccumulator;

  public constructor(config: BalanceConfig) {
    this.accumulator = new ActiveTimeAccumulator(
      config.time.realSecondsPerGameMinute,
    );
  }

  public advance(
    state: GameState,
    deltaMs: number,
    config: BalanceConfig,
  ): WorkMinigameClockAdvance {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) {
      throw new RangeError(
        'Work minigame deltaMs must be finite and non-negative',
      );
    }

    if (
      deltaMs === 0 ||
      state.barryInterruptPending ||
      state.terminalReason !== null ||
      state.victory
    ) {
      return {
        state,
        advancedMinutes: 0,
        interruptedByBarry: state.barryInterruptPending,
        terminal: state.terminalReason !== null || state.victory,
      };
    }

    const requestedMinutes = this.accumulator.consume(
      deltaMs / 1000,
      true,
    );

    let nextState = state;
    let advancedMinutes = 0;

    for (
      let index = 0;
      index < requestedMinutes;
      index += 1
    ) {
      const advanced = advanceRunTime(
        nextState,
        null,
        1,
        config,
      );
      nextState = advanced.state;
      advancedMinutes += advanced.advancedMinutes;

      if (
        nextState.barryInterruptPending ||
        nextState.terminalReason !== null ||
        nextState.victory
      ) {
        break;
      }
    }

    return {
      state: nextState,
      advancedMinutes,
      interruptedByBarry: nextState.barryInterruptPending,
      terminal:
        nextState.terminalReason !== null || nextState.victory,
    };
  }
}
