import type { GameState } from '../../core/state/GameState';
import type { ActiveAction, WorkActiveAction } from '../../core/actions/ActiveAction';
import type { WorkSkillCompletion } from '../../core/work/skillCompletion';
import { parseClockTime, type GameClockState } from '../../core/time/GameClock';
import { balance } from '../../config/balance';
import { getFoodContent, getEntertainmentContent } from '../content/contentCatalog';

const signed = (value: number): string => `${value >= 0 ? '+' : '−'}${Math.abs(value).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}`;
const label = (action: ActiveAction): string => {
  if (action.kind === 'SLEEP') return 'Сон';
  if (action.kind === 'DUMPSTER') return 'Помойка';
  if (action.kind === 'WORK') return 'Смена';
  if (action.actionId === 'SHOWER') return 'Душ';
  if (balance.food.some(entry => entry.id === action.actionId)) return getFoodContent(action.actionId).title;
  if (balance.entertainment.some(entry => entry.id === action.actionId)) return getEntertainmentContent(action.actionId).title;
  return 'Действие';
};

// Game days start at the configured Barry boundary, not midnight.
export const elapsedFeedbackMinutes = (before: GameClockState, after: GameClockState): number => {
  const boundary = parseClockTime(balance.barry.time);
  const stamp = (clock: GameClockState) => clock.gameDayIndex * 1440 + (clock.minuteOfDay - boundary + 1440) % 1440;
  return stamp(after) - stamp(before);
};

export const formatActionFeedback = (action: ActiveAction, before: GameState, after: GameState, minutes: number, completed = !after.barryInterruptPending): string => {
  const status = after.terminalReason !== null ? 'забег завершён' : after.barryInterruptPending
    ? completed ? 'готово, Барри ждёт' : 'прервано Барри'
    : 'готово';
  const needs = ([['health', 'HP'], ['satiety', 'сытость'], ['energy', 'энергия'], ['happiness', 'счастье']] as const)
    .map(([key, name]) => ({ name, delta: Math.round((after.needs[key] - before.needs[key]) * 10) / 10 }))
    .filter(entry => entry.delta !== 0).map(entry => `${entry.name} ${signed(entry.delta)}`);
  const smell = before.statuses.SMELLY !== after.statuses.SMELLY ? after.statuses.SMELLY ? ' · ВОНЮЧИЙ' : ' · запах смыт' : '';
  return `${label(action)}: ${status} · ${minutes} мин · деньги ${signed(after.cash - before.cash)} ₽\n${needs.join(' · ') || 'Потребности не изменились'}${smell}`;
};

let pendingWorkFeedback: string | null = null;
export const publishWorkFeedback = (action: WorkActiveAction, before: GameState, completion: WorkSkillCompletion): void => {
  const after = completion.state;
  const outcome = action.result === 'FAILURE' ? 'ПРОВАЛ' : 'УСПЕХ';
  const cash = after.cash - before.cash;
  const payment = after.terminalReason !== null ? 'смена не оплачена' : completion.shiftCompleted
    ? action.result === 'FAILURE' ? `штраф ${Math.abs(cash).toLocaleString('ru-RU')} ₽` : `выплата ${signed(cash)} ₽`
    : 'выплата после завершения смены';
  const minutes = elapsedFeedbackMinutes({ gameDayIndex: action.startedAtGameDayIndex, minuteOfDay: action.startedAtMinuteOfDay }, after.clock);
  pendingWorkFeedback = `${outcome} · ${payment} · прошло ${minutes} мин${after.barryInterruptPending ? ' · Барри!' : ''}\n${completion.shiftCompleted ? 'После смены' : 'Сейчас'}: HP ${Math.round(after.needs.health)} · сытость ${Math.round(after.needs.satiety)} · энергия ${Math.round(after.needs.energy)} · счастье ${Math.round(after.needs.happiness)}`;
};
export const consumeWorkFeedback = (): string | null => {
  const message = pendingWorkFeedback; pendingWorkFeedback = null; return message;
};
