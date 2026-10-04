import type { BalanceConfig } from '../../config/balance.schema';
import type { GameState, NeedsState } from '../../core/state/GameState';
import { advanceNeeds } from '../../core/needs/needs';
import { applyTimedPaidCompletion, type TimedPaidActionDefinition } from '../../core/actions/timedPaidAction';
import { minutesUntilClockTime } from '../../core/time/GameClock';

export interface NeedsForecast { needs: NeedsState; caption: string; }

/** Deterministic needs-only projection; never draws RNG or advances the real save. */
export const forecastRecovery = (state: GameState, definition: TimedPaidActionDefinition, config: BalanceConfig): NeedsForecast => {
  const untilBarry = minutesUntilClockTime(state.clock, config.barry.time);
  const interrupted = definition.durationMinutes >= untilBarry;
  const advanced = advanceNeeds(state, Math.min(definition.durationMinutes, untilBarry), 'AWAKE', config).state;
  const result = interrupted ? advanced : applyTimedPaidCompletion(advanced, definition, config);
  return { needs: { ...result.needs }, caption: result.terminalReason ? 'Опасно: здоровье закончится до восстановления' : interrupted ? 'До прихода Барри: действие ещё не завершится' : 'После действия · прогноз без случайных событий' };
};
