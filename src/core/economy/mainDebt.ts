import { debitCash } from './money';
import type { GameState } from '../state/GameState';

export const canPayMainDebt = (state: GameState): boolean =>
  state.terminalReason === null &&
  !state.barryInterruptPending &&
  !state.victory &&
  state.mainDebt > 0 &&
  state.cash >= state.mainDebt;

export const payMainDebt = (state: GameState): GameState => {
  if (!canPayMainDebt(state)) {
    throw new Error('Main debt cannot be paid in the current state');
  }

  return {
    ...state,
    cash: debitCash(state.cash, state.mainDebt),
    mainDebt: 0,
    victory: true,
  };
};
