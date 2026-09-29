export type TutorialStep =
  | 'BARRY'
  | 'FIRST_WORK'
  | 'FIRST_DROP'
  | 'CHEAP_UPGRADE'
  | 'NEEDS'
  | 'RECOVERY'
  | 'FIRST_BARRY_PAYMENT'
  | 'DONE';

export type TutorialMilestone =
  | 'WORK_COMPLETED'
  | 'DROP_RESOLVED'
  | 'UPGRADE_BOUGHT'
  | 'RECOVERY_USED'
  | 'BARRY_PAID';

export interface TutorialProgress {
  version: 1;
  barryAcknowledged: boolean;
  workCompleted: boolean;
  dropResolved: boolean;
  upgradeBought: boolean;
  needsAcknowledged: boolean;
  recoveryUsed: boolean;
  barryPaid: boolean;
}

const STORAGE_KEY = '67m:tutorial:v1';

export const createInitialTutorialProgress =
  (): TutorialProgress => ({
    version: 1,
    barryAcknowledged: false,
    workCompleted: false,
    dropResolved: false,
    upgradeBought: false,
    needsAcknowledged: false,
    recoveryUsed: false,
    barryPaid: false,
  });

export const deriveTutorialStep = (
  progress: TutorialProgress,
): TutorialStep => {
  if (!progress.barryAcknowledged) return 'BARRY';
  if (!progress.workCompleted) return 'FIRST_WORK';
  if (!progress.dropResolved) return 'FIRST_DROP';
  if (!progress.upgradeBought) return 'CHEAP_UPGRADE';
  if (!progress.needsAcknowledged) return 'NEEDS';
  if (!progress.recoveryUsed) return 'RECOVERY';
  if (!progress.barryPaid) return 'FIRST_BARRY_PAYMENT';
  return 'DONE';
};

export const applyTutorialMilestone = (
  progress: TutorialProgress,
  milestone: TutorialMilestone,
): TutorialProgress => {
  if (milestone === 'WORK_COMPLETED') {
    return { ...progress, workCompleted: true };
  }
  if (milestone === 'DROP_RESOLVED') {
    return { ...progress, dropResolved: true };
  }
  if (milestone === 'UPGRADE_BOUGHT') {
    return { ...progress, upgradeBought: true };
  }
  if (milestone === 'RECOVERY_USED') {
    return { ...progress, recoveryUsed: true };
  }
  return { ...progress, barryPaid: true };
};

export const acknowledgeTutorialInfo = (
  progress: TutorialProgress,
  step: 'BARRY' | 'NEEDS',
): TutorialProgress =>
  step === 'BARRY'
    ? { ...progress, barryAcknowledged: true }
    : { ...progress, needsAcknowledged: true };

const isTutorialProgress = (
  value: unknown,
): value is TutorialProgress => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('version' in value) ||
    value.version !== 1
  ) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return [
    'barryAcknowledged',
    'workCompleted',
    'dropResolved',
    'upgradeBought',
    'needsAcknowledged',
    'recoveryUsed',
    'barryPaid',
  ].every((key) => typeof candidate[key] === 'boolean');
};

export const parseTutorialProgress = (
  raw: string | null,
): TutorialProgress => {
  if (raw === null) return createInitialTutorialProgress();

  try {
    const parsed: unknown = JSON.parse(raw);
    return isTutorialProgress(parsed)
      ? parsed
      : createInitialTutorialProgress();
  } catch {
    return createInitialTutorialProgress();
  }
};

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

let memoryProgress = createInitialTutorialProgress();

export const loadTutorialProgress = (): TutorialProgress => {
  const storage = getStorage();
  if (storage === null) return { ...memoryProgress };

  try {
    const progress = parseTutorialProgress(
      storage.getItem(STORAGE_KEY),
    );
    memoryProgress = progress;
    return { ...progress };
  } catch {
    return { ...memoryProgress };
  }
};

export const saveTutorialProgress = (
  progress: TutorialProgress,
): void => {
  memoryProgress = { ...progress };

  const storage = getStorage();
  if (storage === null) return;

  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify(progress),
    );
  } catch {
    // Tutorial progress is UI-only; gameplay must continue.
  }
};

export const recordTutorialMilestone = (
  milestone: TutorialMilestone,
): TutorialProgress => {
  const next = applyTutorialMilestone(
    loadTutorialProgress(),
    milestone,
  );
  saveTutorialProgress(next);
  return next;
};

export const acknowledgeCurrentTutorialInfo = (
  step: 'BARRY' | 'NEEDS',
): TutorialProgress => {
  const next = acknowledgeTutorialInfo(
    loadTutorialProgress(),
    step,
  );
  saveTutorialProgress(next);
  return next;
};
