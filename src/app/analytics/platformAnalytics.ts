import { ConsoleAnalyticsAdapter, type AnalyticsAdapter } from '@danilah/mini-games-kit/platform';
import { installYandexMetricaTag, MetricaAnalyticsAdapter } from '@danilah/mini-games-kit/yandex';

export const parseMetricaCounterId = (value: string | undefined): number | null => {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const counter = Number(value);
  return Number.isSafeInteger(counter) ? counter : null;
};

export const createGameAnalyticsAdapter = (yandex: boolean, counterValue: string | undefined, debug: boolean): AnalyticsAdapter => {
  const fallback = new ConsoleAnalyticsAdapter(debug);
  const counterId = parseMetricaCounterId(counterValue);
  if (!yandex || counterId === null) return fallback;
  try {
    installYandexMetricaTag(counterId);
    return new MetricaAnalyticsAdapter(counterId, fallback);
  } catch { return fallback; }
};
