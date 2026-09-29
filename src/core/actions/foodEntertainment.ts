import type { BalanceConfig } from '../../config/balance.schema';
import type { ActiveAction, TimedPaidActiveAction } from './ActiveAction';
import {
  applyTimedPaidCompletion,
  startTimedPaidAction,
  type StartedTimedPaidAction,
  type TimedPaidActionDefinition,
} from './timedPaidAction';
import type { PendingDrop } from '../plinko-rules/drop';
import type { GameState } from '../state/GameState';

type FoodConfigEntry = BalanceConfig['food'][number];
type EntertainmentConfigEntry = BalanceConfig['entertainment'][number];

const assertCanStartRecoveryAction = (
  activeAction: ActiveAction | null,
  pendingDrop: PendingDrop | null,
): void => {
  if (pendingDrop !== null) {
    throw new Error('Cannot start recovery action while a Drop is pending');
  }
  if (activeAction !== null) {
    throw new Error('Cannot start recovery action while another action is active');
  }
};

const getFoodEntry = (
  config: BalanceConfig,
  foodId: string,
): FoodConfigEntry => {
  const entry = config.food.find((candidate) => candidate.id === foodId);
  if (!entry) throw new Error(`Unknown food: ${foodId}`);
  return entry;
};

const getEntertainmentEntry = (
  config: BalanceConfig,
  entertainmentId: string,
): EntertainmentConfigEntry => {
  const entry = config.entertainment.find(
    (candidate) => candidate.id === entertainmentId,
  );
  if (!entry) throw new Error(`Unknown entertainment: ${entertainmentId}`);
  return entry;
};

const foodToTimedDefinition = (
  entry: FoodConfigEntry,
): TimedPaidActionDefinition => ({
  id: entry.id,
  price: entry.price,
  durationMinutes: entry.durationMinutes,
  completionNeedsDelta: {
    satiety: entry.satiety,
    happiness: entry.happiness,
    energy: entry.energy,
    health: entry.hp,
  },
});

const entertainmentToTimedDefinition = (
  entry: EntertainmentConfigEntry,
): TimedPaidActionDefinition => ({
  id: entry.id,
  price: entry.price,
  durationMinutes: entry.durationMinutes,
  completionNeedsDelta: {
    happiness: entry.happiness,
  },
});

export const startFood = (
  state: GameState,
  activeAction: ActiveAction | null,
  pendingDrop: PendingDrop | null,
  config: BalanceConfig,
  foodId: string,
): StartedTimedPaidAction => {
  assertCanStartRecoveryAction(activeAction, pendingDrop);
  return startTimedPaidAction(
    state,
    foodToTimedDefinition(getFoodEntry(config, foodId)),
  );
};

export const startEntertainment = (
  state: GameState,
  activeAction: ActiveAction | null,
  pendingDrop: PendingDrop | null,
  config: BalanceConfig,
  entertainmentId: string,
): StartedTimedPaidAction => {
  assertCanStartRecoveryAction(activeAction, pendingDrop);
  return startTimedPaidAction(
    state,
    entertainmentToTimedDefinition(
      getEntertainmentEntry(config, entertainmentId),
    ),
  );
};

const getCompletionDefinition = (
  config: BalanceConfig,
  actionId: string,
): TimedPaidActionDefinition => {
  const food = config.food.find((entry) => entry.id === actionId);
  const entertainment = config.entertainment.find(
    (entry) => entry.id === actionId,
  );

  if (food && entertainment) {
    throw new Error(`Ambiguous recovery action id: ${actionId}`);
  }
  if (food) return foodToTimedDefinition(food);
  if (entertainment) return entertainmentToTimedDefinition(entertainment);

  throw new Error(`Unknown recovery action: ${actionId}`);
};

export const settleRecoveryAction = (
  state: GameState,
  action: TimedPaidActiveAction,
  config: BalanceConfig,
): GameState =>
  applyTimedPaidCompletion(
    state,
    getCompletionDefinition(config, action.actionId),
    config,
  );
