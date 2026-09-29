import type { BalanceConfig } from '../../config/balance.schema';
import { SeededRandom } from '../rng/SeededRandom';
import type { GameState } from '../state/GameState';

export interface EventCheckpointAdvanceOptions {
  isSleeping: boolean;
  eligibleEventIds?: readonly string[];
}

export interface EventCheckpointAdvanceResult {
  state: GameState;
  attemptedCheckpoints: number;
  pendingCreated: string | null;
}

export interface PendingEventPresentationContext {
  skillInputActive: boolean;
  pendingDropActive: boolean;
}

const configuredEventIds = (config: BalanceConfig): string[] =>
  config.events.definitions.map((definition) => definition.id);

const eligiblePool = (
  state: GameState,
  config: BalanceConfig,
  requestedIds?: readonly string[],
): string[] => {
  const configured = new Set(configuredEventIds(config));
  const source = requestedIds ?? configuredEventIds(config);
  const unique = [...new Set(source)].filter((id) => configured.has(id));

  return config.events.noImmediateRepeat && state.lastResolvedEventId !== null
    ? unique.filter((id) => id !== state.lastResolvedEventId)
    : unique;
};

export const advanceEventCheckpoints = (
  state: GameState,
  checkpointsCrossed: readonly string[],
  config: BalanceConfig,
  options: EventCheckpointAdvanceOptions,
): EventCheckpointAdvanceResult => {
  if (
    state.terminalReason !== null ||
    state.victory ||
    state.eventsResolvedThisGameDay >= config.events.maxPerGameDay ||
    (options.isSleeping && !config.time.eventChecksDuringSleep)
  ) {
    return {
      state,
      attemptedCheckpoints: 0,
      pendingCreated: null,
    };
  }

  if (config.events.pendingLimit !== 1) {
    throw new Error('V0 event scheduler requires pendingLimit = 1');
  }
  if (!config.events.suppressRollsWhilePending) {
    throw new Error('V0 event scheduler requires rolls suppressed while pending');
  }
  if (state.pendingEventId !== null) {
    return {
      state,
      attemptedCheckpoints: 0,
      pendingCreated: null,
    };
  }

  const fixedCheckpoints = new Set(config.time.eventCheckpoints);
  const checkpoints = checkpointsCrossed.filter((checkpoint) =>
    fixedCheckpoints.has(checkpoint),
  );
  if (checkpoints.length === 0) {
    return {
      state,
      attemptedCheckpoints: 0,
      pendingCreated: null,
    };
  }

  const rng = new SeededRandom(state.rngState);
  let attemptedCheckpoints = 0;
  let pendingEventId: string | null = null;

  for (const _checkpoint of checkpoints) {
    attemptedCheckpoints += 1;
    if (rng.next() >= config.events.chancePerCheckpoint) continue;

    const pool = eligiblePool(state, config, options.eligibleEventIds);
    if (pool.length === 0) continue;

    const selectedIndex = Math.min(
      pool.length - 1,
      Math.floor(rng.next() * pool.length),
    );
    pendingEventId = pool[selectedIndex]!;
    break;
  }

  return {
    state: {
      ...state,
      rngState: rng.snapshot().state,
      pendingEventId,
    },
    attemptedCheckpoints,
    pendingCreated: pendingEventId,
  };
};

export const getPresentablePendingEventId = (
  state: GameState,
  context: PendingEventPresentationContext,
): string | null => {
  if (
    state.pendingEventId === null ||
    state.terminalReason !== null ||
    state.victory ||
    state.barryInterruptPending ||
    context.skillInputActive ||
    context.pendingDropActive
  ) {
    return null;
  }

  return state.pendingEventId;
};

export const resolvePendingEvent = (
  state: GameState,
  eventId: string,
  config: BalanceConfig,
): GameState => {
  if (state.pendingEventId === null) {
    throw new Error('No pending event to resolve');
  }
  if (state.pendingEventId !== eventId) {
    throw new Error('Resolved event does not match pending event');
  }
  if (state.eventsResolvedThisGameDay >= config.events.maxPerGameDay) {
    throw new Error('Daily event resolution limit reached');
  }

  return {
    ...state,
    pendingEventId: null,
    eventsResolvedThisGameDay: state.eventsResolvedThisGameDay + 1,
    lastResolvedEventId: eventId,
  };
};

export const resetEventGameDayCounter = (
  state: GameState,
): GameState =>
  state.eventsResolvedThisGameDay === 0
    ? state
    : { ...state, eventsResolvedThisGameDay: 0 };
