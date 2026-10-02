import { z } from 'zod';
import { physicsCheckpointSchema } from '../plinko-rules/physicsCheckpoint';

import type { ActiveAction } from '../actions/ActiveAction';
import type { PendingDrop } from '../plinko-rules/drop';
import type { GameState } from '../state/GameState';

export const SAVE_VERSION = 15 as const;

const gameClockSchema = z.object({
  gameDayIndex: z.number().int().nonnegative(),
  minuteOfDay: z.number().min(0).lt(24 * 60),
});

const gameStateSchema = z.object({
  cash: z.number().int().nonnegative(),
  mainDebt: z.number().int().nonnegative(),
  clock: gameClockSchema,
  needs: z.object({
    health: z.number(),
    satiety: z.number(),
    energy: z.number(),
    happiness: z.number(),
  }),
  barryPaymentIndex: z.number().int().nonnegative(),
  barryInterruptPending: z.boolean(),
  totalBarryPaid: z.number().int().nonnegative(),
  sleepMinutesCurrentGameDay: z.number().int().nonnegative(),
  workPayoutMultiplier: z.number().min(0).max(1),
  jobLevels: z.object({
    dishes: z.number().int().positive(),
    trash: z.number().int().positive(),
    courier: z.number().int().positive(),
  }),
  dumpsterSearchStreak: z.number().int().nonnegative(),
  statuses: z.object({
    SMELLY: z.boolean(),
  }),
  pendingEventId: z.string().min(1).nullable(),
  eventsResolvedThisGameDay: z.number().int().nonnegative(),
  lastResolvedEventId: z.string().min(1).nullable(),
  eventModifiers: z.object({
    nextWorksPayoutMultiplier: z.object({
      multiplier: z.number().nonnegative(),
      remainingCount: z.number().int().positive(),
    }).nullable(),
    nextBarryMultiplier: z.object({
      multiplier: z.number().nonnegative(),
      remainingCount: z.number().int().positive(),
    }).nullable(),
    plinkoLockRemainingMinutes: z.number().nonnegative(),
    jobLockRemainingMinutes: z.object({
      dishes: z.number().nonnegative(),
      trash: z.number().nonnegative(),
      courier: z.number().nonnegative(),
    }),
    foodPriceMultiplier: z.object({
      multiplier: z.number().nonnegative(),
      remainingMinutes: z.number().positive(),
    }).nullable(),
  }),
  plinkoSelectedBetFraction: z.union([z.literal(0.25), z.literal(0.5), z.literal(1)]),
  plinkoMaxBetLevel: z.number().int().nonnegative(),
  plinkoCenterLevel: z.number().int().nonnegative(),
  plinkoMidLevel: z.number().int().nonnegative(),
  plinkoJackpotLevel: z.number().int().nonnegative(),
  plinkoAmplifierLevel: z.number().int().nonnegative(),
  plinkoReturnLevel: z.number().int().nonnegative(),
  plinkoSplitterLevel: z.number().int().nonnegative(),
  plinkoJackpotBiasLevel: z.number().int().nonnegative(),
  plinkoInsuranceLevel: z.number().int().nonnegative(),
  plinkoInsuranceLossStreak: z.number().int().nonnegative(),
  plinkoInsuranceArmed: z.object({
    level: z.number().int().positive(),
    floor: z.number().min(0).max(1),
  }).nullable(),
  rngState: z.number().int().nonnegative(),
  terminalReason: z.enum(['BARRY_PAYMENT_FAILED', 'HEALTH_ZERO']).nullable(),
  victory: z.boolean(),
}).superRefine((state, context) => {
  if (state.victory && state.mainDebt !== 0) {
    context.addIssue({ code: 'custom', path: ['mainDebt'], message: 'Victory requires paid principal' });
  }
  if (
    state.plinkoInsuranceLevel === 0 &&
    (state.plinkoInsuranceLossStreak !== 0 ||
      state.plinkoInsuranceArmed !== null)
  ) {
    context.addIssue({
      code: 'custom',
      path: ['plinkoInsuranceLevel'],
      message: 'Insurance streak/arm requires an owned Insurance level',
    });
  }
});

const activeBase = {
  actionId: z.string().min(1),
  remainingMinutes: z.number().nonnegative(),
  startedAtGameDayIndex: z.number().int().nonnegative(),
  startedAtMinuteOfDay: z.number().min(0).lt(24 * 60),
};

const activeActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('TIMED_PAID'), upfrontApplied: z.literal(true), ...activeBase }),
  z.object({
    kind: z.literal('WORK'),
    upfrontApplied: z.literal(true),
    level: z.number().int().positive(),
    result: z.enum(['SUCCESS', 'FAILURE']).nullable(),
    ...activeBase,
  }),
  z.object({ kind: z.literal('DUMPSTER'), upfrontApplied: z.literal(true), ...activeBase }),
  z.object({ kind: z.literal('SLEEP'), upfrontApplied: z.literal(false), ...activeBase }),
  z.object({ kind: z.literal('EVENT_TIME'), upfrontApplied: z.literal(true), ...activeBase }),
]);

const ballSnapshotSchema = z.object({
  ballId: z.string().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
  velocityX: z.number().finite(),
  velocityY: z.number().finite(),
  angle: z.number().finite(),
  angularVelocity: z.number().finite(),
  currentValue: z.number().positive(),
  lineageId: z.string().min(1),
  splitDepth: z.number().int().nonnegative(),
  amplifierProcIds: z.array(z.string()),
  returnUsed: z.boolean(),
  blockedSplitterId: z.string().nullable(),
  watchdogStationaryTicks: z.number().int().nonnegative().default(0),
});

const dropPhysicsSnapshotSchema = z.object({
  fixedTicksElapsed: z.number().int().nonnegative(),
  alreadySettledPayout: z.number().int().nonnegative(),
  balls: z.array(ballSnapshotSchema).max(24),
  solver: physicsCheckpointSchema.optional(),
});

const pendingShotSchema = z.object({
  dropId: z.string().min(1),
  originalStake: z.number().int().positive(),
  selectedFraction: z.union([z.literal(0.25), z.literal(0.5), z.literal(1)]),
  maxBetLevel: z.number().int().nonnegative(),
  pocketLevelsAtCommit: z.object({
    centerLevel: z.number().int().nonnegative(),
    midLevel: z.number().int().nonnegative(),
    jackpotLevel: z.number().int().nonnegative(),
  }),
  specialLevelsAtCommit: z.object({
    amplifierLevel: z.number().int().nonnegative(),
    returnLevel: z.number().int().nonnegative(),
    splitterLevel: z.number().int().nonnegative(),
    jackpotBiasLevel: z.number().int().nonnegative(),
  }),
  insuranceAtCommit: z.object({
    level: z.number().int().positive(),
    floor: z.number().min(0).max(1),
  }).nullable(),
  committedGameDayIndex: z.number().int().nonnegative(),
  committedMinuteOfDay: z.number().min(0).lt(24 * 60),
  remainingActionMinutes: z.number().nonnegative(),
  rngStateAtCommit: z.number().int().nonnegative(),
  boardFingerprint: z.string().min(1),
  physics: dropPhysicsSnapshotSchema.nullable(),
});

const pendingDropSchema = pendingShotSchema.extend({
  additionalDrops: z.array(pendingShotSchema).max(5).optional(),
});

export interface SaveState {
  version: typeof SAVE_VERSION;
  game: GameState;
  activeAction: ActiveAction | null;
  pendingDrop: PendingDrop | null;
}

const saveStateSchema = z.object({
  version: z.literal(SAVE_VERSION),
  game: gameStateSchema,
  activeAction: activeActionSchema.nullable(),
  pendingDrop: pendingDropSchema.nullable(),
}).superRefine((save, context) => {
  if (save.pendingDrop) {
    const shots = [save.pendingDrop, ...(save.pendingDrop.additionalDrops ?? [])];
    if (new Set(shots.map(shot => shot.dropId)).size !== shots.length) {
      context.addIssue({ code: 'custom', path: ['pendingDrop'], message: 'Paid Drop IDs must be unique' });
    }
    for (const shot of shots.slice(1)) {
      if (shot.boardFingerprint !== save.pendingDrop.boardFingerprint || (shot.physics?.balls.length ?? 0) > 0 || shot.physics?.solver) {
        context.addIssue({ code: 'custom', path: ['pendingDrop', 'additionalDrops'], message: 'Concurrent Drops must share one board and solver' });
      }
    }
  }
  if (save.pendingDrop !== null && save.activeAction !== null) {
    context.addIssue({
      code: 'custom',
      path: ['pendingDrop'],
      message: 'pendingDrop and activeAction cannot coexist',
    });
  }
});

export const createSaveState = (game: GameState): SaveState => ({
  version: SAVE_VERSION,
  game,
  activeAction: null,
  pendingDrop: null,
});

export const parseSaveState = (value: unknown): SaveState => saveStateSchema.parse(value);
