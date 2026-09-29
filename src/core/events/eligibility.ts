import type { BalanceConfig } from '../../config/balance.schema';
import type { GameState } from '../state/GameState';
import { hasStatus } from '../state/statuses';
import { isJobEventLocked } from './modifiers';

export const isEventEligible = (
  state: GameState,
  config: BalanceConfig,
  eventId: string,
): boolean => {
  const definition = config.events.definitions.find(
    (candidate) => candidate.id === eventId,
  );
  if (!definition) throw new Error(`Unknown event: ${eventId}`);

  switch (definition.eligibility) {
    case 'ALWAYS':
      return true;
    case 'NOT_SMELLY':
      return !hasStatus(state, 'SMELLY');
    case 'AT_LEAST_ONE_JOB_NOT_EVENT_LOCKED':
      return (
        !isJobEventLocked(state, 'dishes') ||
        !isJobEventLocked(state, 'trash') ||
        !isJobEventLocked(state, 'courier')
      );
    default:
      throw new Error(
        `Unsupported event eligibility: ${definition.eligibility}`,
      );
  }
};

export const getEligibleEventIds = (
  state: GameState,
  config: BalanceConfig,
): string[] =>
  config.events.definitions
    .filter((definition) =>
      isEventEligible(state, config, definition.id),
    )
    .map((definition) => definition.id);
