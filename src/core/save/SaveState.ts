import { z } from 'zod';

import type { ActiveAction } from '../actions/ActiveAction';
import type { GameState } from '../state/GameState';

export const SAVE_VERSION = 1 as const;

const gameClockSchema = z.object({
  gameDayIndex: z.number().int().nonnegative(),
  minuteOfDay: z.number().min(0).lt(24 * 60),
});

const gameStateSchema = z.object({
  cash: z.number().int().nonnegative(),
  mainDebt: z.number().int().positive(),
  clock: gameClockSchema,
  needs: z.object({
    health: z.number(),
    satiety: z.number(),
    energy: z.number(),
    happiness: z.number(),
  }),
  barryPaymentIndex: z.number().int().nonnegative(),
  rngState: z.number().int().nonnegative(),
  terminalReason: z.enum(['BARRY_PAYMENT_FAILED', 'HEALTH_ZERO']).nullable(),
});

const activeActionSchema = z.object({
  kind: z.enum(['TIMED_PAID', 'WORK', 'DUMPSTER', 'SLEEP']),
  actionId: z.string().min(1),
  remainingMinutes: z.number().nonnegative(),
  upfrontApplied: z.boolean(),
  startedAtGameDayIndex: z.number().int().nonnegative(),
  startedAtMinuteOfDay: z.number().min(0).lt(24 * 60),
});

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
