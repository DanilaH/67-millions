import { z } from 'zod';

import type { ActiveAction } from '../actions/ActiveAction';
import type { GameState } from '../state/GameState';

export const SAVE_VERSION = 2 as const;

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

export interface SaveState {
  version: typeof SAVE_VERSION;
  game: GameState;
  activeAction: ActiveAction | null;
  pendingDrop: null;
}

const saveStateSchema = z.object({
  version: z.literal(SAVE_VERSION),
  game: gameStateSchema,
  activeAction: activeActionSchema.nullable(),
  pendingDrop: z.null(),
});

export const createSaveState = (game: GameState): SaveState => ({
  version: SAVE_VERSION,
  game,
  activeAction: null,
  pendingDrop: null,
});

export const parseSaveState = (value: unknown): SaveState => saveStateSchema.parse(value);
