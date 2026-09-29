import type { BalanceConfig } from '../../config/balance.schema';
import {
  getEventChoiceAvailability,
  type EventChoiceId,
} from '../../core/events/eventEffects';
import type { GameState } from '../../core/state/GameState';
import {
  getEventContent,
} from '../content/contentCatalog';

export interface EventChoicePresentation {
  id: EventChoiceId;
  label: string;
  cashCost: number;
  available: boolean;
  lockedReason: string | null;
}

export interface EventPresentation {
  id: string;
  title: string;
  body: string;
  choices: [
    EventChoicePresentation,
    EventChoicePresentation,
  ];
}

const buildChoice = (
  state: GameState,
  config: BalanceConfig,
  eventId: string,
  choiceId: EventChoiceId,
  label: string,
): EventChoicePresentation => {
  const availability = getEventChoiceAvailability(
    state,
    config,
    eventId,
    choiceId,
  );
  const priceSuffix =
    availability.cashCost > 0
      ? ` · ${availability.cashCost.toLocaleString('ru-RU')} ₽`
      : '';

  return {
    id: choiceId,
    label: `${label}${priceSuffix}`,
    cashCost: availability.cashCost,
    available: availability.available,
    lockedReason: availability.available
      ? null
      : 'НЕ ХВАТАЕТ ДЕНЕГ',
  };
};

export const buildEventPresentation = (
  state: GameState,
  config: BalanceConfig,
  eventId: string,
): EventPresentation => {
  const content = getEventContent(eventId);

  return {
    id: eventId,
    title: content.title,
    body: content.body,
    choices: [
      buildChoice(
        state,
        config,
        eventId,
        'a',
        content.choiceA,
      ),
      buildChoice(
        state,
        config,
        eventId,
        'b',
        content.choiceB,
      ),
    ],
  };
};
