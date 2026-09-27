import type { BalanceConfig } from '../../config/balance.schema';
import { debitCash, roundMoney } from '../economy/money';
import type { GameState } from '../state/GameState';
import { markTerminal } from '../state/mutations';

export const getBarryPayment = (
  config: BalanceConfig,
  paymentIndex: number,
): number => {
  if (!Number.isInteger(paymentIndex) || paymentIndex < 0) {
    throw new RangeError('paymentIndex must be a non-negative integer');
  }

  const ladder = config.barry.payments;
  const listed = ladder[paymentIndex];
  if (listed !== undefined) return listed;

  const last = ladder[ladder.length - 1]!;
  const extraSteps = paymentIndex - (ladder.length - 1);
  return roundMoney(last * config.barry.afterLastMultiplier ** extraSteps);
};

export const beginBarryInterrupt = (state: GameState): GameState => {
  if (state.terminalReason !== null || state.victory) return state;
  return { ...state, barryInterruptPending: true };
};

export const resolveBarryPayment = (
  state: GameState,
  config: BalanceConfig,
): GameState => {
  if (!state.barryInterruptPending) {
    throw new Error('Barry payment is not currently due');
  }
  if (state.terminalReason !== null || state.victory) return state;

  const due = getBarryPayment(config, state.barryPaymentIndex);
  if (state.cash < due) {
    return {
      ...markTerminal(state, 'BARRY_PAYMENT_FAILED').state,
      barryInterruptPending: false,
    };
  }

  return {
    ...state,
    cash: debitCash(state.cash, due),
    barryPaymentIndex: state.barryPaymentIndex + 1,
    totalBarryPaid: state.totalBarryPaid + due,
    barryInterruptPending: false,
  };
};
