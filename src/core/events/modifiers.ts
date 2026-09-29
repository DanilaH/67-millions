import type { BalanceConfig } from '../../config/balance.schema';
import type { GameState } from '../state/GameState';

export type EventLockedJobId = keyof BalanceConfig['work']['jobs'];

const dec = (value: number, minutes: number): number =>
  Math.max(0, value - minutes);

export const advanceEventModifiers = (
  state: GameState,
  advancedMinutes: number,
): GameState => {
  if (!Number.isFinite(advancedMinutes) || advancedMinutes < 0) {
    throw new RangeError('advancedMinutes must be finite and non-negative');
  }
  if (advancedMinutes === 0) return state;

  const foodPrice = state.eventModifiers.foodPriceMultiplier;
  const nextFoodPrice =
    foodPrice === null
      ? null
      : {
          ...foodPrice,
          remainingMinutes: dec(foodPrice.remainingMinutes, advancedMinutes),
        };

  return {
    ...state,
    eventModifiers: {
      ...state.eventModifiers,
      plinkoLockRemainingMinutes: dec(
        state.eventModifiers.plinkoLockRemainingMinutes,
        advancedMinutes,
      ),
      jobLockRemainingMinutes: {
        dishes: dec(
          state.eventModifiers.jobLockRemainingMinutes.dishes,
          advancedMinutes,
        ),
        trash: dec(
          state.eventModifiers.jobLockRemainingMinutes.trash,
          advancedMinutes,
        ),
        courier: dec(
          state.eventModifiers.jobLockRemainingMinutes.courier,
          advancedMinutes,
        ),
      },
      foodPriceMultiplier:
        nextFoodPrice !== null && nextFoodPrice.remainingMinutes > 0
          ? nextFoodPrice
          : null,
    },
  };
};

export const isJobEventLocked = (
  state: GameState,
  jobId: EventLockedJobId,
): boolean => state.eventModifiers.jobLockRemainingMinutes[jobId] > 0;

export const isPlinkoEventLocked = (state: GameState): boolean =>
  state.eventModifiers.plinkoLockRemainingMinutes > 0;

export const getFoodEventPriceMultiplier = (state: GameState): number =>
  state.eventModifiers.foodPriceMultiplier?.multiplier ?? 1;

export const refreshWorkPayoutModifier = (
  state: GameState,
  multiplier: number,
  count: number,
): GameState => ({
  ...state,
  eventModifiers: {
    ...state.eventModifiers,
    nextWorksPayoutMultiplier: {
      multiplier,
      remainingCount: Math.max(
        state.eventModifiers.nextWorksPayoutMultiplier?.remainingCount ?? 0,
        count,
      ),
    },
  },
});

export const consumeWorkPayoutModifier = (
  state: GameState,
): { state: GameState; multiplier: number } => {
  const modifier = state.eventModifiers.nextWorksPayoutMultiplier;
  if (modifier === null) return { state, multiplier: 1 };

  const remainingCount = modifier.remainingCount - 1;
  return {
    multiplier: modifier.multiplier,
    state: {
      ...state,
      eventModifiers: {
        ...state.eventModifiers,
        nextWorksPayoutMultiplier:
          remainingCount > 0
            ? { ...modifier, remainingCount }
            : null,
      },
    },
  };
};

export const refreshNextBarryModifier = (
  state: GameState,
  multiplier: number,
  count: number,
): GameState => ({
  ...state,
  eventModifiers: {
    ...state.eventModifiers,
    nextBarryMultiplier: {
      multiplier,
      remainingCount: Math.max(
        state.eventModifiers.nextBarryMultiplier?.remainingCount ?? 0,
        count,
      ),
    },
  },
});

export const consumeNextBarryModifier = (state: GameState): GameState => {
  const modifier = state.eventModifiers.nextBarryMultiplier;
  if (modifier === null) return state;

  const remainingCount = modifier.remainingCount - 1;
  return {
    ...state,
    eventModifiers: {
      ...state.eventModifiers,
      nextBarryMultiplier:
        remainingCount > 0
          ? { ...modifier, remainingCount }
          : null,
    },
  };
};

export const refreshPlinkoLock = (
  state: GameState,
  durationMinutes: number,
): GameState => ({
  ...state,
  eventModifiers: {
    ...state.eventModifiers,
    plinkoLockRemainingMinutes: Math.max(
      state.eventModifiers.plinkoLockRemainingMinutes,
      durationMinutes,
    ),
  },
});

export const refreshJobLock = (
  state: GameState,
  jobId: EventLockedJobId,
  durationMinutes: number,
): GameState => ({
  ...state,
  eventModifiers: {
    ...state.eventModifiers,
    jobLockRemainingMinutes: {
      ...state.eventModifiers.jobLockRemainingMinutes,
      [jobId]: Math.max(
        state.eventModifiers.jobLockRemainingMinutes[jobId],
        durationMinutes,
      ),
    },
  },
});

export const refreshFoodPriceModifier = (
  state: GameState,
  multiplier: number,
  durationMinutes: number,
): GameState => ({
  ...state,
  eventModifiers: {
    ...state.eventModifiers,
    foodPriceMultiplier: {
      multiplier,
      remainingMinutes: Math.max(
        state.eventModifiers.foodPriceMultiplier?.remainingMinutes ?? 0,
        durationMinutes,
      ),
    },
  },
});
