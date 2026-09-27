import { describe, expect, it } from 'vitest';

import rawBalance from '../balance.v0.json';
import { parseBalanceConfig } from '../src/config/balance';

describe('balance config', () => {
  it('accepts canonical balance.v0.json', () => {
    const parsed = parseBalanceConfig(rawBalance);
    expect(parsed.meta.version).toBe('0.7-canonical-preproduction');
    expect(parsed.plinko.basePockets).toHaveLength(parsed.plinko.rows + 1);
  });

  it('fails fast on malformed runtime config', () => {
    const broken = structuredClone(rawBalance) as typeof rawBalance;
    broken.game.startCash = -1;
    expect(() => parseBalanceConfig(broken)).toThrow();
  });
});
