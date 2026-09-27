import { z } from 'zod';

import { SAVE_VERSION, parseSaveState, type SaveState } from './SaveState';

const versionProbeSchema = z.object({
  version: z.number().int().nonnegative(),
}).passthrough();

const v1Schema = z.object({
  version: z.literal(1),
  game: z.object({
    cash: z.number().int().nonnegative(),
    mainDebt: z.number().int().positive(),
    clock: z.object({
      gameDayIndex: z.number().int().nonnegative(),
      minuteOfDay: z.number().min(0).lt(24 * 60),
    }),
    needs: z.object({
      health: z.number(),
      satiety: z.number(),
      energy: z.number(),
      happiness: z.number(),
    }),
    barryPaymentIndex: z.number().int().nonnegative(),
    rngState: z.number().int().nonnegative(),
    terminalReason: z.enum(['BARRY_PAYMENT_FAILED', 'HEALTH_ZERO']).nullable(),
  }),
  activeAction: z.object({
    kind: z.enum(['TIMED_PAID', 'WORK', 'DUMPSTER', 'SLEEP']),
    actionId: z.string().min(1),
    remainingMinutes: z.number().nonnegative(),
    upfrontApplied: z.boolean(),
    startedAtGameDayIndex: z.number().int().nonnegative(),
    startedAtMinuteOfDay: z.number().min(0).lt(24 * 60),
  }).nullable(),
  pendingDrop: z.null(),
});

export class UnsupportedSaveVersionError extends Error {
  public constructor(public readonly version: number) {
    super(`Unsupported save version: ${version}`);
    this.name = 'UnsupportedSaveVersionError';
  }
}

const migrateV1 = (value: unknown): SaveState => {
  const old = v1Schema.parse(value);
  if (old.activeAction?.kind === 'WORK') {
    throw new Error('Cannot safely migrate a v1 WORK action without level/result state');
  }

  const activeAction = old.activeAction === null
    ? null
    : old.activeAction.kind === 'SLEEP'
      ? { ...old.activeAction, kind: 'SLEEP' as const, upfrontApplied: false as const }
      : old.activeAction.kind === 'TIMED_PAID'
        ? { ...old.activeAction, kind: 'TIMED_PAID' as const, upfrontApplied: true as const }
        : { ...old.activeAction, kind: 'DUMPSTER' as const, upfrontApplied: true as const };

  return parseSaveState({
    version: SAVE_VERSION,
    game: {
      ...old.game,
      barryInterruptPending: false,
      totalBarryPaid: 0,
      sleepMinutesCurrentGameDay: 0,
      workPayoutMultiplier: 1,
      victory: false,
    },
    activeAction,
    pendingDrop: null,
  });
};

export const migrateSaveState = (value: unknown): SaveState => {
  const { version } = versionProbeSchema.parse(value);

  if (version === SAVE_VERSION) return parseSaveState(value);
  if (version === 1) return migrateV1(value);

  throw new UnsupportedSaveVersionError(version);
};
