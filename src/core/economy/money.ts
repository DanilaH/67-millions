export const roundMoney = (value: number): number => {
  if (!Number.isFinite(value)) throw new TypeError('Money value must be finite');
  return Math.round(value);
};

export const creditCash = (cash: number, amount: number): number => {
  const next = roundMoney(cash) + roundMoney(amount);
  if (next < 0) throw new RangeError('Credit cannot produce negative cash');
  return next;
};

export const debitCash = (cash: number, amount: number): number => {
  const normalizedCash = roundMoney(cash);
  const normalizedAmount = roundMoney(amount);
  if (normalizedAmount < 0) throw new RangeError('Debit amount must be non-negative');
  if (normalizedAmount > normalizedCash) throw new RangeError('Insufficient cash');
  return normalizedCash - normalizedAmount;
};
