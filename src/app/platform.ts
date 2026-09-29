import { WebStorageAdapter } from '@danilah/mini-games-kit/platform';
import {
  bootstrapYandexPlatformRuntime,
  createMockPlatformRuntime,
  type PlatformRuntime,
} from '@danilah/mini-games-kit/yandex';

import { createGameAnalyticsAdapter } from '../analytics/platformAnalytics';
import { SAVE_STORAGE_KEY } from '../core/save/repository';
import {
  YANDEX_SAVE_CLOUD_FIELD,
  reconcileYandexSaveRaw,
} from '../core/save/yandexPersistence';
import { normalizeGameLanguage, type GameLanguage } from './language';

export const isYandexBuild = (): boolean => import.meta.env.VITE_PLATFORM === 'yandex';

export const createPlatformRuntime = async (): Promise<PlatformRuntime<GameLanguage>> => {
  const yandex = isYandexBuild();
  const analytics = createGameAnalyticsAdapter({
    yandex,
    metricaCounterId:
      import.meta.env.VITE_YANDEX_METRICA_ID,
    debugConsole:
      import.meta.env.VITE_DEBUG_PANEL === 'true',
  });

  if (yandex) {
    return bootstrapYandexPlatformRuntime<GameLanguage>({
      normalizeLanguage: normalizeGameLanguage,
      analytics,
      cloud: {
        syncKey: SAVE_STORAGE_KEY,
        cloudField: YANDEX_SAVE_CLOUD_FIELD,
        reconcile: reconcileYandexSaveRaw,
        onError: (operation, error) => {
          console.warn(
            `Yandex save mirror ${operation} failed`,
            error,
          );
        },
        onPlayerUnavailable: (error) => {
          console.warn(
            'Yandex Player Data unavailable; using local save only',
            error,
          );
        },
      },
    });
  }

  return createMockPlatformRuntime<GameLanguage>({
    language: normalizeGameLanguage(typeof navigator === 'undefined' ? undefined : navigator.language),
    storage: new WebStorageAdapter(window.localStorage),
    analytics,
  });
};
