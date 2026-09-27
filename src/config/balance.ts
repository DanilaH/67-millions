import rawBalance from '../../balance.v0.json';

import { balanceSchema, type BalanceConfig } from './balance.schema';

export const parseBalanceConfig = (value: unknown): BalanceConfig => balanceSchema.parse(value);

export const balance = parseBalanceConfig(rawBalance);
