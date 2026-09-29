import type { BalanceConfig } from '../../config/balance.schema';
import { getBarryPaymentDue } from '../../core/barry/barry';
import type { GameState } from '../../core/state/GameState';
import {
  formatClockTime,
  minutesUntilClockTime,
} from '../../core/time/GameClock';

export interface HudNeed {
  id: 'health' | 'satiety' | 'energy' | 'happiness';
  label: string;
  value: number;
}

export interface HudSnapshot {
  day: number;
  time: string;
  cash: number;
  nextBarry: number;
  minutesUntilBarry: number;
  mainDebt: number;
  needs: HudNeed[];
  statuses: string[];
}

export const formatBarryCountdown = (
  minutes: number,
): string => {
  const safe = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;

  if (hours <= 0) return `${mins}м`;
  return `${hours}ч ${String(mins).padStart(2, '0')}м`;
};

export const deriveHudSnapshot = (
  state: GameState,
  config: BalanceConfig,
): HudSnapshot => ({
  day: state.clock.gameDayIndex + 1,
  time: formatClockTime(state.clock.minuteOfDay),
  cash: state.cash,
  nextBarry: getBarryPaymentDue(state, config),
  minutesUntilBarry: state.barryInterruptPending
    ? 0
    : minutesUntilClockTime(
        state.clock,
        config.barry.time,
      ),
  mainDebt: state.mainDebt,
  needs: [
    { id: 'health', label: 'HP', value: state.needs.health },
    { id: 'satiety', label: 'СЫТОСТЬ', value: state.needs.satiety },
    { id: 'energy', label: 'ЭНЕРГИЯ', value: state.needs.energy },
    { id: 'happiness', label: 'СЧАСТЬЕ', value: state.needs.happiness },
  ],
  statuses: state.statuses.SMELLY
    ? ['ВОНЮЧИЙ']
    : [],
});
