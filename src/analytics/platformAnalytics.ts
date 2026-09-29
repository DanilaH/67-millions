import {
  ConsoleAnalyticsAdapter,
  type AnalyticsAdapter,
} from '@danilah/mini-games-kit/platform';
import {
  installYandexMetricaTag,
  MetricaAnalyticsAdapter,
} from '@danilah/mini-games-kit/yandex';

export const parseMetricaCounterId = (
  raw: string | undefined,
): number | null => {
  if (raw === undefined || raw.trim() === '') {
    return null;
  }

  if (!/^\d+$/.test(raw.trim())) {
    return null;
  }

  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0
    ? value
    : null;
};

export const createGameAnalyticsAdapter = (
  options: {
    yandex: boolean;
    metricaCounterId?: string;
    debugConsole?: boolean;
  },
): AnalyticsAdapter => {
  const consoleAdapter =
    new ConsoleAnalyticsAdapter(
      options.debugConsole ?? false,
    );

  if (!options.yandex) {
    return consoleAdapter;
  }

  const counterId = parseMetricaCounterId(
    options.metricaCounterId,
  );
  if (counterId === null) {
    return consoleAdapter;
  }

  installYandexMetricaTag(counterId);
  return new MetricaAnalyticsAdapter(
    counterId,
    consoleAdapter,
  );
};
