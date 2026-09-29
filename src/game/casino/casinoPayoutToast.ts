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
