import { forecastRecovery, type NeedsForecast } from './needsForecast';
import { advanceNeeds } from '../../core/needs/needs';
import { formatClockTime, minutesUntilClockTime } from '../../core/time/GameClock';
import { roundMoney } from '../../core/economy/money';
import type { BalanceConfig } from '../../config/balance.schema';
import type { ActiveAction } from '../../core/actions/ActiveAction';
import {
  applyDumpsterStartCost,
  getDumpsterEmptyChance,
  startDumpsterSearch,
} from '../../core/actions/dumpster';
import {
  getEntertainmentActionDefinition,
  getFoodActionDefinition,
  startEntertainment,
  startFood,
} from '../../core/actions/foodEntertainment';
import { startShower } from '../../core/actions/shower';
import type { PendingDrop } from '../../core/plinko-rules/drop';
import { startSleep } from '../../core/sleep/sleep';
import type { GameState } from '../../core/state/GameState';
import {
  getWorkLevelDefinition,
  startWork,
  purchaseJobUpgrade,
  type JobId,
} from '../../core/work/work';
import {
  getEntertainmentContent,
  getFoodContent,
} from '../content/contentCatalog';

export interface ActionPreview {
  id: string;
  title: string;
  cta?: string;
  forecast?: NeedsForecast;
  timing?: string;
  summary: string[];
  lockedReason: string | null;
}

const translateLockReason = (error: unknown): string => {
  const message =
    error instanceof Error ? error.message : String(error);

  if (message.includes('Insufficient cash')) {
    return 'Недостаточно денег';
  }
  if (message.includes('Drop is pending')) {
    return 'Дождись завершения Plinko Drop';
  }
  if (message.includes('another action is active')) {
    return 'Сначала заверши текущее действие';
  }
  if (message.includes('current run state')) {
    return 'Сейчас действие недоступно';
  }
  if (message.includes('event-locked')) {
    return 'Работа временно заблокирована событием';
  }
  if (message.includes('blocked by SMELLY')) {
    return 'Сначала прими душ — работа недоступна из-за запаха';
  }
  if (message.includes('outside its start window')) {
    return 'Сейчас работа закрыта';
  }
  if (message.includes('Not enough Energy')) {
    return 'Недостаточно энергии — поспи дома';
  }
  if (message.includes('not owned')) {
    return 'Этот уровень работы ещё не куплен';
  }
  if (message.includes('Cannot sleep')) {
    return 'Сейчас нельзя спать';
  }
  if (message.includes('Cannot search dumpster')) {
    return 'Сейчас нельзя рыться в помойке';
  }
  if (message.includes('Cannot shower')) {
    return 'Сейчас нельзя принять душ';
  }

  return message;
};

const validate = (run: () => void): string | null => {
  try {
    run();
    return null;
  } catch (error: unknown) {
    return translateLockReason(error);
  }
};

const globalWorkLock = (
  activeAction: ActiveAction | null,
  pendingDrop: PendingDrop | null,
): string | null => {
  if (pendingDrop !== null) return 'Дождись завершения Plinko Drop';
  if (activeAction !== null) return 'Сначала заверши текущее действие';
  return null;
};

const formatSigned = (
  value: number,
  suffix = '',
): string =>
  `${value >= 0 ? '+' : ''}${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;

/** Warn before spending; no simulated payout or needs are treated as guaranteed. */
export const actionTiming = (state: GameState, duration: number, config: BalanceConfig): string => {
  const until = minutesUntilClockTime(state.clock, config.barry.time);
  return state.barryInterruptPending || duration >= until
    ? `Барри до конца действия · платёж в ${config.barry.time}`
    : `Закончишь к ${formatClockTime(state.clock.minuteOfDay + duration)}`;
};

const JOB_TITLES: Record<JobId, string> = {
  dishes: 'ПОСУДА',
  trash: 'МУСОР',
  courier: 'КУРЬЕР',
};

export const buildWorkPreviews = (
  state: GameState,
  activeAction: ActiveAction | null,
  pendingDrop: PendingDrop | null,
  config: BalanceConfig,
): ActionPreview[] =>
  (Object.keys(JOB_TITLES) as JobId[]).map((jobId) => {
    const level = state.jobLevels[jobId];
    const definition = getWorkLevelDefinition(
      config,
      jobId,
      level,
    );
    const eventMultiplier =
      state.eventModifiers.nextWorksPayoutMultiplier?.multiplier ?? 1;
    const potentialPayout = roundMoney(definition.payout * state.workPayoutMultiplier);
    const effectivePayout = roundMoney(potentialPayout * eventMultiplier);
    const potentialFine = roundMoney(potentialPayout * config.work.failure.fineAsPotentialPayout);
    const globalLock = globalWorkLock(
      activeAction,
      pendingDrop,
    );
    const lock =
      globalLock ??
      validate(() => {
        startWork(state, config, jobId, level);
      });

    return {
      id: `work:${jobId}`,
      title: `${JOB_TITLES[jobId]} · L${level}`,
      summary: [
        `Успех +${effectivePayout.toLocaleString('ru-RU')} ₽ · провал: штраф до ${potentialFine.toLocaleString('ru-RU')} ₽, счастье ${formatSigned(config.work.failure.extraHappiness)}`,
        `${definition.durationMinutes} мин · ${definition.window} · энергия -${definition.energyCost} · счастье -${definition.happinessCost}`,
      ],
      cta: 'Начать смену',
      timing: actionTiming(state, definition.durationMinutes, config),
      lockedReason: lock === 'Сейчас работа закрыта' ? `Приём: ${definition.window}` : lock,
    };
  });

export const buildWorkUpgradePreviews = (
  state: GameState,
  activeAction: ActiveAction | null,
  pendingDrop: PendingDrop | null,
  config: BalanceConfig,
): ActionPreview[] => (Object.keys(JOB_TITLES) as JobId[]).map(jobId => {
  const current = getWorkLevelDefinition(config, jobId, state.jobLevels[jobId]);
  const next = config.work.jobs[jobId].levels.find(entry => entry.level === current.level + 1);
  const payout = (value: number) => roundMoney(roundMoney(value * state.workPayoutMultiplier) * (state.eventModifiers.nextWorksPayoutMultiplier?.multiplier ?? 1)).toLocaleString('ru-RU');
  return {
    id: `work-upgrade:${jobId}`,
    cta: next ? `Улучшить · ${next.upgradePrice.toLocaleString('ru-RU')} ₽` : 'Максимум',
    title: `${JOB_TITLES[jobId]} · ${next ? `L${current.level} → L${next.level}` : `L${current.level}`}`,
    summary: next ? [
      `${next.upgradePrice.toLocaleString('ru-RU')} ₽ · выплата ${payout(current.payout)} → ${payout(next.payout)} ₽`,
      `${next.window} · ${next.durationMinutes} мин · энергия -${next.energyCost} · счастье -${next.happinessCost}`,
    ] : ['Максимальный уровень', `${current.window} · выплата ${payout(current.payout)} ₽`],
    lockedReason: next ? validate(() => { purchaseJobUpgrade(state, activeAction, pendingDrop, config, jobId); }) : 'Уже улучшено полностью',
  };
});

export const buildFoodPreviews = (
  state: GameState,
  activeAction: ActiveAction | null,
  pendingDrop: PendingDrop | null,
  config: BalanceConfig,
): ActionPreview[] =>
  config.food.map((entry) => {
    const definition = getFoodActionDefinition(
      state,
      entry,
    );
    const deltas = [
      entry.satiety !== 0
        ? `сытость ${formatSigned(entry.satiety)}`
        : null,
      entry.energy !== 0
        ? `энергия ${formatSigned(entry.energy)}`
        : null,
      entry.happiness !== 0
        ? `счастье ${formatSigned(entry.happiness)}`
        : null,
      entry.hp !== 0
        ? `HP ${formatSigned(entry.hp)}`
        : null,
    ].filter((value): value is string => value !== null);

    const content = getFoodContent(entry.id);

    return {
      id: `food:${entry.id}`,
      cta: `Поесть · ${definition.price.toLocaleString('ru-RU')} ₽`,
      forecast: forecastRecovery(state, definition, config),
      timing: actionTiming(state, definition.durationMinutes, config),
      title: content.title,
      summary: [
        `${definition.price.toLocaleString('ru-RU')} ₽ · ${definition.durationMinutes} мин`,
        deltas.join(' · '),
        content.description,
      ],
      lockedReason: validate(() => {
        startFood(
          state,
          activeAction,
          pendingDrop,
          config,
          entry.id,
        );
      }),
    };
  });

export const buildEntertainmentPreviews = (
  state: GameState,
  activeAction: ActiveAction | null,
  pendingDrop: PendingDrop | null,
  config: BalanceConfig,
): ActionPreview[] =>
  config.entertainment.map((entry) => {
    const definition = getEntertainmentActionDefinition(
      state,
      entry,
      config,
    );
    const happiness =
      definition.completionNeedsDelta?.happiness ?? 0;

    const content = getEntertainmentContent(entry.id);

    return {
      id: `entertainment:${entry.id}`,
      cta: definition.price ? `Отдохнуть · ${definition.price.toLocaleString('ru-RU')} ₽` : 'Отдохнуть бесплатно',
      forecast: forecastRecovery(state, definition, config),
      timing: actionTiming(state, definition.durationMinutes, config),
      title: content.title,
      summary: [
        `${definition.price.toLocaleString('ru-RU')} ₽ · ${definition.durationMinutes} мин`,
        `счастье ${formatSigned(happiness)}${state.statuses.SMELLY && definition.price > 0 ? ' · ВОНЮЧИЙ снижает эффект' : ''}`,
        content.description,
      ],
      lockedReason: validate(() => {
        startEntertainment(
          state,
          activeAction,
          pendingDrop,
          config,
          entry.id,
        );
      }),
    };
  });

export const buildSleepPreviews = (
  state: GameState,
  activeAction: ActiveAction | null,
  pendingDrop: PendingDrop | null,
  config: BalanceConfig,
): ActionPreview[] => {
  const globalLock = globalWorkLock(
    activeAction,
    pendingDrop,
  );
  const lock =
    globalLock ??
    validate(() => {
      startSleep(state, config);
    });

  const duration = Math.min(config.sleep.fullSleepHours * 60, minutesUntilClockTime(state.clock, config.barry.time));
  const forecast = advanceNeeds(state, duration, 'SLEEP', config);
  const delta = forecast.state.needs;
  return [{
    id: 'sleep',
    cta: `Спать до ${formatClockTime((state.clock.minuteOfDay + duration) % 1440)}`,
    title: 'СОН',
    forecast: { needs: { ...delta }, caption: forecast.state.terminalReason ? 'Опасно: здоровье закончится во сне' : 'После сна · прогноз без случайных событий' },
    summary: [
      `Бесплатно · проснёшься в ${formatClockTime((state.clock.minuteOfDay + duration) % 1440)}`,
      `Энергия ${Math.round(state.needs.energy)} → ${Math.round(delta.energy)} · здоровье ${Math.round(state.needs.health)} → ${Math.round(delta.health)}`,
      `Сытость ${Math.round(state.needs.satiety)} → ${Math.round(delta.satiety)} · сон до ${duration} мин`,
      forecast.state.terminalReason ? 'ОПАСНО: здоровье закончится во сне' : duration < config.sleep.fullSleepHours * 60 ? 'Барри прервёт сон в 09:00. Недосып снижает доход работ.' : 'Полный сон. После пробуждения можно вернуться к делам.',
    ],
    lockedReason: lock,
  }];
};

export const buildDumpsterPreviews = (
  state: GameState,
  activeAction: ActiveAction | null,
  pendingDrop: PendingDrop | null,
  config: BalanceConfig,
): ActionPreview[] => {
  const cost = applyDumpsterStartCost(
    state,
    config,
  );
  const emptyChance = getDumpsterEmptyChance(
    config,
    state.dumpsterSearchStreak,
  );

  return [{
    id: 'dumpster',
    cta: 'Начать поиск',
    timing: actionTiming(state, config.dumpster.durationMinutes, config),
    title: 'ПОРЫТЬСЯ',
    summary: [
      `0 ₽ · ${config.dumpster.durationMinutes} мин`,
      `энергия -${cost.energySpent} · счастье -${cost.happinessSpent.toFixed(1)} · HP -${cost.healthSpent.toFixed(1)}`,
      `пусто: ${Math.round(emptyChance * 100)}% · статус ВОНЮЧИЙ`,
    ],
    lockedReason: validate(() => {
      startDumpsterSearch(
        state,
        activeAction,
        pendingDrop,
        config,
      );
    }),
  }];
};

export const buildShowerPreviews = (
  state: GameState,
  activeAction: ActiveAction | null,
  pendingDrop: PendingDrop | null,
  config: BalanceConfig,
): ActionPreview[] => [{
  id: 'shower',
  cta: `Помыться · ${config.shower.price.toLocaleString('ru-RU')} ₽`,
  title: 'ДУШ',
  timing: actionTiming(state, config.shower.durationMinutes, config),
  summary: [
    `${config.shower.price.toLocaleString('ru-RU')} ₽ · ${config.shower.durationMinutes} мин`,
    'Смывает статус ВОНЮЧИЙ',
  ],
  lockedReason: validate(() => {
    startShower(
      state,
      activeAction,
      pendingDrop,
      config,
    );
  }),
}];
