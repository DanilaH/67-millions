import { balance } from '../../config/balance';
export interface CasinoPayoutToast {
  stake: number;
  payout: number;
  multiplier: number;
  losing: boolean;
  insuranceApplied: boolean;
  insuranceTopUp: number;
}

let pendingCasinoPayoutToast: CasinoPayoutToast | null = null;

export const publishCasinoPayoutToast = (
  toast: CasinoPayoutToast,
): void => {
  pendingCasinoPayoutToast = { ...toast };
};

export const consumeCasinoPayoutToast =
  (): CasinoPayoutToast | null => {
    const toast = pendingCasinoPayoutToast;
    pendingCasinoPayoutToast = null;
    return toast;
  };

export const peekCasinoPayoutToast =
  (): CasinoPayoutToast | null =>
    pendingCasinoPayoutToast === null
      ? null
      : { ...pendingCasinoPayoutToast };

export const formatCasinoResult = (toast: CasinoPayoutToast): string => {
  const net = toast.payout - toast.stake;
  return `Выплата ${toast.payout.toLocaleString('ru-RU')} ₽ · итог ${net >= 0 ? '+' : '−'}${Math.abs(net).toLocaleString('ru-RU')} ₽\nСтавка ${toast.stake.toLocaleString('ru-RU')} ₽ · ×${toast.multiplier.toFixed(2)}` +
    (toast.insuranceApplied ? ` · страховка +${toast.insuranceTopUp.toLocaleString('ru-RU')} ₽ уже включена` : '') +
    (toast.losing ? ` · счастье ${balance.needs.plinkoLosingDropHappiness}` : '');
};
