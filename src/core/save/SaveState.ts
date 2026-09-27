import { z } from 'zod';

import type { ActiveAction } from '../actions/ActiveAction';
import type { PendingDrop } from '../plinko-rules/drop';
import type { GameState } from '../state/GameState';

export const SAVE_VERSION = 5 as const;

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
  plinkoSelectedBetFraction: z.union([z.literal(0.25), z.literal(0.5), z.literal(1)]),
  plinkoMaxBetLevel: z.number().int().nonnegative(),
  plinkoCenterLevel: z.number().int().nonnegative(),
  plinkoMidLevel: z.number().int().nonnegative(),
  plinkoJackpotLevel: z.number().int().nonnegative(),
  rngState: z.number().int().nonnegative(),
  terminalReason: z.enum(['BARRY_PAYMENT_FAILED', 'HEALTH_ZERO']).nullable(),
  victory: z.boolean(),
}).superRefine((state, context) => {
  if (state.victory && state.mainDebt !== 0) {
    context.addIssue({ code: 'custom', path: ['mainDebt'], message: 'Victory requires paid principal' });
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
});

const dropPhysicsSnapshotSchema = z.object({
  fixedTicksElapsed: z.number().int().nonnegative(),
  alreadySettledPayout: z.number().int().nonnegative(),
  balls: z.array(ballSnapshotSchema).max(24),
});

const pendingDropSchema = z.object({
  dropId: z.string().min(1),
  originalStake: z.number().int().positive(),
  selectedFraction: z.union([z.literal(0.25), z.literal(0.5), z.literal(1)]),
  maxBetLevel: z.number().int().nonnegative(),
  pocketLevelsAtCommit: z.object({
    centerLevel: z.number().int().nonnegative(),
    midLevel: z.number().int().nonnegative(),
    jackpotLevel: z.number().int().nonnegative(),
  }),
  committedGameDayIndex: z.number().int().nonnegative(),
  committedMinuteOfDay: z.number().min(0).lt(24 * 60),
  remainingActionMinutes: z.number().nonnegative(),
  rngStateAtCommit: z.number().int().nonnegative(),
  boardFingerprint: z.string().min(1),
  physics: dropPhysicsSnapshotSchema.nullable(),
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
