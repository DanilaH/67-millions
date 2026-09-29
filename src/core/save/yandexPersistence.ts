import { migrateSaveState } from './migrations';

export const YANDEX_SAVE_CLOUD_FIELD =
  'saveState' as const;

const isValidSaveRaw = (
  raw: string | null,
): raw is string => {
  if (raw === null) return false;

  try {
    const parsed: unknown = JSON.parse(raw);
    migrateSaveState(parsed);
    return true;
  } catch {
    return false;
  }
};

/**
 * MVP cloud conflict policy.
 *
 * Local is authoritative when it contains a valid SaveState. Cloud is used to
 * restore a missing/corrupt local copy. Without durable revision metadata there
 * is no safe way to infer cross-device freshness from gameplay fields, so we
 * deliberately never overwrite a valid local run with a cloud guess.
 */
export const reconcileYandexSaveRaw = (
  localRaw: string | null,
  cloudRaw: string | null,
): string | null => {
  if (isValidSaveRaw(localRaw)) {
    return localRaw;
  }

  if (isValidSaveRaw(cloudRaw)) {
    return cloudRaw;
  }

  return null;
};
