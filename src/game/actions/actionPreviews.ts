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
  type JobId,
} from '../../core/work/work';
import {
  getEntertainmentContent,
  getFoodContent,
} from '../content/contentCatalog';

export interface ActionPreview {
  id: string;
  title: string;
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
    return 'Сначала смой статус ВОНЮЧИЙ';
  }
  if (message.includes('outside its start window')) {
    return 'Сейчас работа закрыта';
  }
  if (message.includes('Not enough Energy')) {
    return 'Недостаточно энергии';
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
    const effectivePayout = Math.round(
      definition.payout *
        state.workPayoutMultiplier *
        eventMultiplier,
    );
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
        `Успех +${effectivePayout.toLocaleString('ru-RU')} ₽ · провал 0 ₽ / штраф 25%`,
        `${definition.durationMinutes} мин · ${definition.window} · энергия -${definition.energyCost} · счастье -${definition.happinessCost}`,
      ],
      lockedReason: lock,
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
      title: content.title,
      summary: [
        content.description,
        `${definition.price.toLocaleString('ru-RU')} ₽ · ${definition.durationMinutes} мин`,
        deltas.join(' · '),
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
      title: content.title,
      summary: [
        content.description,
        `${definition.price.toLocaleString('ru-RU')} ₽ · ${definition.durationMinutes} мин`,
        `счастье ${formatSigned(happiness)}`,
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

  return [{
    id: 'sleep',
    title: 'СОН',
    summary: [
      `0 ₽ · ${config.sleep.fullSleepHours * 60} мин`,
      'энергия восстанавливается постепенно',
      `HP до +${config.sleep.fullSleepHealthRestore} за полный сон`,
      'Барри в 09:00 разбудит',
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
  title: 'ДУШ',
  summary: [
    `${config.shower.price.toLocaleString('ru-RU')} ₽ · ${config.shower.durationMinutes} мин`,
    `снимает: ${config.shower.removes.join(', ')}`,
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
