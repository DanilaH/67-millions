import { WebStorageAdapter } from '@danilah/mini-games-kit/platform';
import {
  bootstrapYandexPlatformRuntime,
  createMockPlatformRuntime,
  type PlatformRuntime,
} from '@danilah/mini-games-kit/yandex';

import { SAVE_STORAGE_KEY } from '../core/save/repository';
import {
  YANDEX_SAVE_CLOUD_FIELD,
  reconcileYandexSaveRaw,
} from '../core/save/yandexPersistence';
import { normalizeGameLanguage, type GameLanguage } from './language';

export const isYandexBuild = (): boolean => import.meta.env.VITE_PLATFORM === 'yandex';

export const createPlatformRuntime = async (): Promise<PlatformRuntime<GameLanguage>> => {
  if (isYandexBuild()) {
    return bootstrapYandexPlatformRuntime<GameLanguage>({
      normalizeLanguage: normalizeGameLanguage,
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
  });
};
