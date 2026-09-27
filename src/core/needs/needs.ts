import type { BalanceConfig } from '../../config/balance.schema';
import type { GameState } from '../state/GameState';
import { applyNeedsDelta } from '../state/mutations';

export type ActivityMode = 'AWAKE' | 'SLEEP';

export interface NeedsAdvanceResult {
  state: GameState;
  consumedMinutes: number;
}

const perMinute = (perHour: number): number => perHour / 60;

const lowNeedHpLossPerMinute = (
  state: GameState,
  config: BalanceConfig,
): number => {
  const tracked = [
    state.needs.satiety,
    state.needs.energy,
    state.needs.happiness,
  ];

  let hpLossPerHour = 0;
  for (const value of tracked) {
    if (value <= config.needs.lowThreshold) {
      hpLossPerHour += config.needs.hpLossPerLowNeedPerHour;
    }
    if (value <= config.needs.min) {
      hpLossPerHour += config.needs.extraHpLossPerZeroNeedPerHour;
    }
  }

  return hpLossPerHour / 60;
};

const advanceSingleMinute = (
  state: GameState,
  mode: ActivityMode,
  config: BalanceConfig,
): GameState => {
  const baseDelta =
    mode === 'SLEEP'
      ? {
          satiety: perMinute(config.needs.satietyPerHour),
          energy: config.needs.max / (config.sleep.fullSleepHours * 60),
          happiness: 0,
          health: config.sleep.fullSleepHealthRestore / (config.sleep.fullSleepHours * 60),
        }
      : {
          satiety: perMinute(config.needs.satietyPerHour),
          energy: perMinute(config.needs.energyAwakePerHour),
          happiness: perMinute(config.needs.happinessAwakePerHour),
          health: 0,
        };

  let next = applyNeedsDelta(state, baseDelta, {
    min: config.needs.min,
    max: config.needs.max,
  }).state;

  if (next.terminalReason !== null) return next;

  const attrition = lowNeedHpLossPerMinute(next, config);
  if (attrition > 0) {
    next = applyNeedsDelta(
      next,
      { health: -attrition },
      { min: config.needs.min, max: config.needs.max },
    ).state;
  }

  if (mode === 'SLEEP') {
    next = {
      ...next,
      sleepMinutesCurrentGameDay: next.sleepMinutesCurrentGameDay + 1,
    };
  }

  return next;
};

export const advanceNeeds = (
  state: GameState,
  minutes: number,
  mode: ActivityMode,
  config: BalanceConfig,
): NeedsAdvanceResult => {
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new RangeError('minutes must be finite and non-negative');
  }

  const wholeMinutes = Math.floor(minutes);
  let current = state;
  let consumedMinutes = 0;

  while (consumedMinutes < wholeMinutes && current.terminalReason === null) {
    current = advanceSingleMinute(current, mode, config);
    consumedMinutes += 1;
  }

  return { state: current, consumedMinutes };
};
