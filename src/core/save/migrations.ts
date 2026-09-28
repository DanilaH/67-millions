import { z } from 'zod';

import { SAVE_VERSION, parseSaveState, type SaveState } from './SaveState';

const versionProbeSchema = z.object({
  version: z.number().int().nonnegative(),
}).passthrough();

const clockSchema = z.object({
  gameDayIndex: z.number().int().nonnegative(),
  minuteOfDay: z.number().min(0).lt(24 * 60),
});

const needsSchema = z.object({
  health: z.number(),
  satiety: z.number(),
  energy: z.number(),
  happiness: z.number(),
});

const terminalSchema = z.enum(['BARRY_PAYMENT_FAILED', 'HEALTH_ZERO']).nullable();

const v1Schema = z.object({
  version: z.literal(1),
  game: z.object({
    cash: z.number().int().nonnegative(),
    mainDebt: z.number().int().positive(),
    clock: clockSchema,
    needs: needsSchema,
    barryPaymentIndex: z.number().int().nonnegative(),
    rngState: z.number().int().nonnegative(),
    terminalReason: terminalSchema,
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

const v2GameSchema = z.object({
  cash: z.number().int().nonnegative(),
  mainDebt: z.number().int().nonnegative(),
  clock: clockSchema,
  needs: needsSchema,
  barryPaymentIndex: z.number().int().nonnegative(),
  barryInterruptPending: z.boolean(),
  totalBarryPaid: z.number().int().nonnegative(),
  sleepMinutesCurrentGameDay: z.number().int().nonnegative(),
  workPayoutMultiplier: z.number().min(0).max(1),
  rngState: z.number().int().nonnegative(),
  terminalReason: terminalSchema,
  victory: z.boolean(),
});

const v3GameSchema = v2GameSchema.extend({
  plinkoSelectedBetFraction: z.union([z.literal(0.25), z.literal(0.5), z.literal(1)]),
  plinkoMaxBetLevel: z.number().int().nonnegative(),
});

const v2Schema = z.object({
  version: z.literal(2),
  game: v2GameSchema,
  activeAction: z.unknown().nullable(),
  pendingDrop: z.null(),
});

const v3Schema = z.object({
  version: z.literal(3),
  game: v3GameSchema,
  activeAction: z.unknown().nullable(),
  pendingDrop: z.unknown().nullable(),
});

const v4PendingDropSchema = z.object({
  dropId: z.string().min(1),
  originalStake: z.number().int().positive(),
  selectedFraction: z.union([z.literal(0.25), z.literal(0.5), z.literal(1)]),
  maxBetLevel: z.number().int().nonnegative(),
  committedGameDayIndex: z.number().int().nonnegative(),
  committedMinuteOfDay: z.number().min(0).lt(24 * 60),
  remainingActionMinutes: z.number().nonnegative(),
  rngStateAtCommit: z.number().int().nonnegative(),
  boardFingerprint: z.string().min(1),
  physics: z.unknown().nullable(),
}).passthrough();

const v4Schema = z.object({
  version: z.literal(4),
  game: v3GameSchema,
  activeAction: z.unknown().nullable(),
  pendingDrop: v4PendingDropSchema.nullable(),
});

const v5GameSchema = v3GameSchema.extend({
  plinkoCenterLevel: z.number().int().nonnegative(),
  plinkoMidLevel: z.number().int().nonnegative(),
  plinkoJackpotLevel: z.number().int().nonnegative(),
});

const v5PendingDropSchema = v4PendingDropSchema.extend({
  pocketLevelsAtCommit: z.object({
    centerLevel: z.number().int().nonnegative(),
    midLevel: z.number().int().nonnegative(),
    jackpotLevel: z.number().int().nonnegative(),
  }),
});

const v5Schema = z.object({
  version: z.literal(5),
  game: v5GameSchema,
  activeAction: z.unknown().nullable(),
  pendingDrop: v5PendingDropSchema.nullable(),
});

const v6GameSchema = v5GameSchema.extend({
  plinkoAmplifierLevel: z.number().int().nonnegative(),
  plinkoReturnLevel: z.number().int().nonnegative(),
  plinkoSplitterLevel: z.number().int().nonnegative(),
});

const v6PendingDropSchema = v5PendingDropSchema.extend({
  specialLevelsAtCommit: z.object({
    amplifierLevel: z.number().int().nonnegative(),
    returnLevel: z.number().int().nonnegative(),
    splitterLevel: z.number().int().nonnegative(),
  }),
});

const v6Schema = z.object({
  version: z.literal(6),
  game: v6GameSchema,
  activeAction: z.unknown().nullable(),
  pendingDrop: v6PendingDropSchema.nullable(),
});

const ZERO_GAME_POCKET_LEVELS = {
  plinkoCenterLevel: 0,
  plinkoMidLevel: 0,
  plinkoJackpotLevel: 0,
} as const;

const ZERO_DROP_POCKET_LEVELS = {
  centerLevel: 0,
  midLevel: 0,
  jackpotLevel: 0,
} as const;

const ZERO_GAME_SPECIAL_LEVELS = {
  plinkoAmplifierLevel: 0,
  plinkoReturnLevel: 0,
  plinkoSplitterLevel: 0,
  plinkoJackpotBiasLevel: 0,
} as const;

const ZERO_DROP_SPECIAL_LEVELS = {
  amplifierLevel: 0,
  returnLevel: 0,
  splitterLevel: 0,
  jackpotBiasLevel: 0,
} as const;

export class UnsupportedSaveVersionError extends Error {
  public constructor(public readonly version: number) {
    super(`Unsupported save version: ${version}`);
    this.name = 'UnsupportedSaveVersionError';
  }
}

const addPlinkoDefaults = <T extends object>(game: T) => ({
  ...game,
  plinkoSelectedBetFraction: 1 as const,
  plinkoMaxBetLevel: 0,
  ...ZERO_GAME_POCKET_LEVELS,
  ...ZERO_GAME_SPECIAL_LEVELS,
});

const addPocketDefaults = <T extends object>(game: T) => ({
  ...game,
  ...ZERO_GAME_POCKET_LEVELS,
  ...ZERO_GAME_SPECIAL_LEVELS,
});

const addSpecialDefaults = <T extends object>(game: T) => ({
  ...game,
  ...ZERO_GAME_SPECIAL_LEVELS,
});

const addBiasDefaults = <T extends object>(game: T) => ({
  ...game,
  plinkoJackpotBiasLevel: 0,
});

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
    game: addPlinkoDefaults({
      ...old.game,
      barryInterruptPending: false,
      totalBarryPaid: 0,
      sleepMinutesCurrentGameDay: 0,
      workPayoutMultiplier: 1,
      victory: false,
    }),
    activeAction,
    pendingDrop: null,
  });
};

const migrateV2 = (value: unknown): SaveState => {
  const old = v2Schema.parse(value);
  return parseSaveState({
    version: SAVE_VERSION,
    game: addPlinkoDefaults(old.game),
    activeAction: old.activeAction,
    pendingDrop: null,
  });
};

const migrateV3 = (value: unknown): SaveState => {
  const old = v3Schema.parse(value);

  if (old.pendingDrop !== null) {
    throw new Error(
      'Cannot safely migrate a v3 active pendingDrop without exact physics state',
    );
  }

  return parseSaveState({
    version: SAVE_VERSION,
    game: addPocketDefaults(old.game),
    activeAction: old.activeAction,
    pendingDrop: null,
  });
};

const migrateV4 = (value: unknown): SaveState => {
  const old = v4Schema.parse(value);

  return parseSaveState({
    version: SAVE_VERSION,
    game: addPocketDefaults(old.game),
    activeAction: old.activeAction,
    pendingDrop:
      old.pendingDrop === null
        ? null
        : {
            ...old.pendingDrop,
            pocketLevelsAtCommit: ZERO_DROP_POCKET_LEVELS,
            specialLevelsAtCommit: ZERO_DROP_SPECIAL_LEVELS,
          },
  });
};

const migrateV5 = (value: unknown): SaveState => {
  const old = v5Schema.parse(value);

  return parseSaveState({
    version: SAVE_VERSION,
    game: addSpecialDefaults(old.game),
    activeAction: old.activeAction,
    pendingDrop:
      old.pendingDrop === null
        ? null
        : {
            ...old.pendingDrop,
            specialLevelsAtCommit: ZERO_DROP_SPECIAL_LEVELS,
          },
  });
};

const migrateV6 = (value: unknown): SaveState => {
  const old = v6Schema.parse(value);

  return parseSaveState({
    version: SAVE_VERSION,
    game: addBiasDefaults(old.game),
    activeAction: old.activeAction,
    pendingDrop:
      old.pendingDrop === null
        ? null
        : {
            ...old.pendingDrop,
            specialLevelsAtCommit: {
              ...old.pendingDrop.specialLevelsAtCommit,
              jackpotBiasLevel: 0,
            },
          },
  });
};

export const migrateSaveState = (value: unknown): SaveState => {
  const { version } = versionProbeSchema.parse(value);

  if (version === SAVE_VERSION) return parseSaveState(value);
  if (version === 6) return migrateV6(value);
  if (version === 5) return migrateV5(value);
  if (version === 4) return migrateV4(value);
  if (version === 3) return migrateV3(value);
  if (version === 2) return migrateV2(value);
  if (version === 1) return migrateV1(value);

  throw new UnsupportedSaveVersionError(version);
};
