import type { BalanceConfig } from '../../config/balance.schema';
import {
  createActiveAction,
  type EventTimeActiveAction,
} from '../actions/ActiveAction';
import { getBarryPaymentDue } from '../barry/barry';
import { debitCash, roundMoney } from '../economy/money';
import { SeededRandom } from '../rng/SeededRandom';
import type { GameState } from '../state/GameState';
import { applyNeedsDelta, type NeedsDelta } from '../state/mutations';
import { applyStatus } from '../state/statuses';
import { isEventEligible } from './eligibility';
import {
  isJobEventLocked,
  refreshFoodPriceModifier,
  refreshJobLock,
  refreshNextBarryModifier,
  refreshPlinkoLock,
  refreshWorkPayoutModifier,
  type EventLockedJobId,
} from './modifiers';
import { resolvePendingEvent } from './eventScheduler';

export type EventChoiceId = 'a' | 'b';

export interface EventChoiceAvailability {
  available: boolean;
  cashCost: number;
}

export interface EventChoiceResolution {
  state: GameState;
  activeAction: EventTimeActiveAction | null;
  cashCost: number;
  lockedJobId: EventLockedJobId | null;
}

type EventChoiceRecord = Record<string, string | number | boolean>;

const getDefinition = (
  config: BalanceConfig,
  eventId: string,
) => {
  const definition = config.events.definitions.find(
    (candidate) => candidate.id === eventId,
  );
  if (!definition) throw new Error(`Unknown event: ${eventId}`);
  return definition;
};

const getChoice = (
  config: BalanceConfig,
  eventId: string,
  choiceId: EventChoiceId,
): EventChoiceRecord => getDefinition(config, eventId)[choiceId];

const numberField = (
  choice: EventChoiceRecord,
  key: string,
): number | null => {
  const value = choice[key];
  if (value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Event choice field ${key} must be numeric`);
  }
  return value;
};

const stringField = (
  choice: EventChoiceRecord,
  key: string,
): string | null => {
  const value = choice[key];
  if (value === undefined) return null;
  if (typeof value !== 'string') {
    throw new Error(`Event choice field ${key} must be a string`);
  }
  return value;
};

export const getEventChoiceCashCost = (
  state: GameState,
  config: BalanceConfig,
  eventId: string,
  choiceId: EventChoiceId,
): number => {
  const choice = getChoice(config, eventId, choiceId);
  const type = stringField(choice, 'type');

  if (type === 'payBarryFraction') {
    const fraction = numberField(choice, 'value');
    if (fraction === null || fraction < 0) {
      throw new Error('payBarryFraction requires a non-negative value');
    }
    return roundMoney(getBarryPaymentDue(state, config) * fraction);
  }

  if (type === 'payMax') {
    const fixed = numberField(choice, 'fixed');
    const fraction = numberField(choice, 'barryFraction');
    if (fixed === null || fraction === null || fixed < 0 || fraction < 0) {
      throw new Error('payMax requires fixed and barryFraction');
    }
    return Math.max(
      roundMoney(fixed),
      roundMoney(getBarryPaymentDue(state, config) * fraction),
    );
  }

  return 0;
};

export const getEventChoiceAvailability = (
  state: GameState,
  config: BalanceConfig,
  eventId: string,
  choiceId: EventChoiceId,
): EventChoiceAvailability => {
  const cashCost = getEventChoiceCashCost(
    state,
    config,
    eventId,
    choiceId,
  );

  return {
    cashCost,
    available:
      !config.events.payChoiceRequiresCash || state.cash >= cashCost,
  };
};

const applyDirectNeeds = (
  state: GameState,
  choice: EventChoiceRecord,
  config: BalanceConfig,
): GameState => {
  const delta: NeedsDelta = {};
  const happiness = numberField(choice, 'happiness');
  const energy = numberField(choice, 'energy');
  const hp = numberField(choice, 'hp');
  const satiety = numberField(choice, 'satiety');

  if (happiness !== null) delta.happiness = happiness;
  if (energy !== null) delta.energy = energy;
  if (hp !== null) delta.health = hp;
  if (satiety !== null) delta.satiety = satiety;

  if (Object.keys(delta).length === 0) return state;
  return applyNeedsDelta(state, delta, {
    min: config.needs.min,
    max: config.needs.max,
  }).state;
};

const applyTypedEffect = (
  state: GameState,
  choice: EventChoiceRecord,
): { state: GameState; lockedJobId: EventLockedJobId | null } => {
  const type = stringField(choice, 'type');

  if (type === null || type === 'payBarryFraction' || type === 'payMax') {
    return { state, lockedJobId: null };
  }

  if (type === 'nextWorksPayoutMultiplier') {
    const multiplier = numberField(choice, 'multiplier');
    const count = numberField(choice, 'count');
    if (
      multiplier === null ||
      count === null ||
      multiplier < 0 ||
      !Number.isInteger(count) ||
      count <= 0
    ) {
      throw new Error('Invalid nextWorksPayoutMultiplier event choice');
    }
    return {
      state: refreshWorkPayoutModifier(state, multiplier, count),
      lockedJobId: null,
    };
  }

  if (type === 'nextBarryMultiplier') {
    const multiplier = numberField(choice, 'multiplier');
    const count = numberField(choice, 'count');
    if (
      multiplier === null ||
      count === null ||
      multiplier < 0 ||
      !Number.isInteger(count) ||
      count <= 0
    ) {
      throw new Error('Invalid nextBarryMultiplier event choice');
    }
    return {
      state: refreshNextBarryModifier(state, multiplier, count),
      lockedJobId: null,
    };
  }

  if (type === 'lockPlinko') {
    const duration = numberField(choice, 'durationMinutes');
    if (duration === null || duration < 0) {
      throw new Error('lockPlinko requires durationMinutes');
    }
    return {
      state: refreshPlinkoLock(state, duration),
      lockedJobId: null,
    };
  }

  if (type === 'lockRandomJob') {
    const duration = numberField(choice, 'durationMinutes');
    if (duration === null || duration < 0) {
      throw new Error('lockRandomJob requires durationMinutes');
    }

    const jobs: EventLockedJobId[] = ['dishes', 'trash', 'courier'];
    const available = jobs.filter((jobId) => !isJobEventLocked(state, jobId));
    if (available.length === 0) {
      throw new Error('No job is available for event lock');
    }

    const rng = new SeededRandom(state.rngState);
    const index = Math.min(
      available.length - 1,
      Math.floor(rng.next() * available.length),
    );
    const jobId = available[index]!;
    const locked = refreshJobLock(state, jobId, duration);

    return {
      state: {
        ...locked,
        rngState: rng.snapshot().state,
      },
      lockedJobId: jobId,
    };
  }

  if (type === 'foodPriceMultiplier') {
    const multiplier = numberField(choice, 'multiplier');
    const duration = numberField(choice, 'durationMinutes');
    if (multiplier === null || duration === null || multiplier < 0 || duration < 0) {
      throw new Error('Invalid foodPriceMultiplier event choice');
    }

    return {
      state: refreshFoodPriceModifier(state, multiplier, duration),
      lockedJobId: null,
    };
  }

  throw new Error(`Unsupported event choice type: ${type}`);
};

export const resolveEventChoice = (
  state: GameState,
  config: BalanceConfig,
  eventId: string,
  choiceId: EventChoiceId,
): EventChoiceResolution => {
  if (state.pendingEventId !== eventId) {
    throw new Error('Event choice does not match pending event');
  }
  if (state.barryInterruptPending || state.terminalReason !== null || state.victory) {
    throw new Error('Cannot resolve event in the current run state');
  }
  if (!isEventEligible(state, config, eventId)) {
    throw new Error('Pending event is no longer eligible');
  }

  const choice = getChoice(config, eventId, choiceId);
  const availability = getEventChoiceAvailability(
    state,
    config,
    eventId,
    choiceId,
  );
  if (!availability.available) {
    throw new Error('Event pay choice is unaffordable');
  }

  let nextState =
    availability.cashCost > 0
      ? { ...state, cash: debitCash(state.cash, availability.cashCost) }
      : state;

  nextState = applyDirectNeeds(nextState, choice, config);

  const status = stringField(choice, 'status');
  if (status !== null) {
    nextState = applyStatus(nextState, status);
  }

  const typed = applyTypedEffect(nextState, choice);
  nextState = typed.state;
  nextState = resolvePendingEvent(nextState, eventId, config);

  const type = stringField(choice, 'type');
  const durationMinutes =
    type === null ? numberField(choice, 'durationMinutes') ?? 0 : 0;

  const activeAction =
    durationMinutes > 0 &&
    nextState.terminalReason === null &&
    !nextState.victory
      ? createActiveAction({
          kind: 'EVENT_TIME',
          actionId: `EVENT_TIME:${eventId}`,
          remainingMinutes: durationMinutes,
          upfrontApplied: true,
          startedAtGameDayIndex: nextState.clock.gameDayIndex,
          startedAtMinuteOfDay: nextState.clock.minuteOfDay,
        }) as EventTimeActiveAction
      : null;

  return {
    state: nextState,
    activeAction,
    cashCost: availability.cashCost,
    lockedJobId: typed.lockedJobId,
  };
};
