import type { BalanceConfig } from '../../config/balance.schema';
import type { GameState } from './GameState';
import { advanceRunTime } from '../time/runTime';

export type DebugCommand = { kind: 'cash' | 'time'; amount: number } | { kind: 'reset' };

export const applyDebugCommand = (state: GameState, command: Exclude<DebugCommand, { kind: 'reset' }>, config: BalanceConfig): GameState => {
  if (!Number.isSafeInteger(command.amount)) throw new Error('Нужно целое безопасное число');
  if (command.kind === 'cash') {
    const cash = state.cash + command.amount;
    if (!Number.isSafeInteger(cash)) throw new Error('Слишком большая сумма');
    return { ...state, cash: Math.max(0, cash) };
  }
  if (command.amount < 1 || command.amount > 1440) throw new Error('Промотка: от 1 до 1440 минут');
  if (state.pendingEventId || state.barryInterruptPending) throw new Error('Сначала разбери событие или заплати Барри');
  if (state.terminalReason || state.victory) throw new Error('Забег завершён — начни новый');
  return advanceRunTime(state, null, command.amount, config).state;
};
