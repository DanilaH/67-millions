import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import type {
  FullGamePolicy,
  PlinkoOutcomeModel,
} from '../simulation/full-game/runner';
import { runFullGame } from '../simulation/full-game/runner';

const rawBalance = readFileSync(
  new URL('../balance.v0.json', import.meta.url),
  'utf8',
);
const configHash = createHash('sha256')
  .update(rawBalance)
  .digest('hex');

const fixedPayoutModel = (
  payout: number,
): PlinkoOutcomeModel => ({
  id: `fixed-${payout}`,
  resolve: ({ state }) => ({
    aggregatePayout: payout,
    nextRngState: (state.rngState + 1) >>> 0,
  }),
});

describe('full-game runner', () => {
  it('reaches manual victory from the canonical initial state and records the exact config hash', () => {
    const policy: FullGamePolicy = {
      id: 'scripted-victory',
      decide: ({ state, counters }) => {
        if (state.pendingEventId !== null) {
          return { type: 'EVENT_CHOICE', choice: 'a' };
        }
        if (counters.plinkoDrops === 0) {
          return { type: 'PLINKO', fraction: 1 };
        }
        return { type: 'PAY_MAIN_DEBT' };
      },
    };

    const result = runFullGame(
      balance,
      policy,
      fixedPayoutModel(balance.game.mainDebt),
      {
        seed: 101,
        configHash,
      },
    );

    expect(result.outcome).toBe('VICTORY');
    expect(result.configHash).toBe(configHash);
    expect(result.configVersion).toBe(balance.meta.version);
    expect(result.state.mainDebt).toBe(0);
    expect(result.state.victory).toBe(true);
    expect(result.counters.plinkoDrops).toBe(1);
  });

  it('reaches Barry loss when the player does not earn enough cash', () => {
    const policy: FullGamePolicy = {
      id: 'scripted-barry-loss',
      decide: ({ state }) =>
        state.pendingEventId !== null
          ? { type: 'EVENT_CHOICE', choice: 'b' }
          : { type: 'WAIT', minutes: 24 * 60 },
    };

    const result = runFullGame(
      balance,
      policy,
      fixedPayoutModel(0),
      {
        seed: 202,
        configHash,
        maxGameMinutes: 3 * 24 * 60,
      },
    );

    expect(result.outcome).toBe('BARRY_LOSS');
    expect(result.state.terminalReason).toBe('BARRY_PAYMENT_FAILED');
    expect(result.state.victory).toBe(false);
  });

  it('reaches HP death through the real needs clock while Barry remains funded', () => {
    const policy: FullGamePolicy = {
      id: 'scripted-hp-death',
      decide: ({ state, counters }) => {
        if (state.pendingEventId !== null) {
          return { type: 'EVENT_CHOICE', choice: 'a' };
        }
        if (counters.plinkoDrops === 0) {
          return { type: 'PLINKO', fraction: 1 };
        }
        return { type: 'WAIT', minutes: 12 * 60 };
      },
    };

    const result = runFullGame(
      balance,
      policy,
      fixedPayoutModel(10_000_000),
      {
        seed: 303,
        configHash,
        maxGameMinutes: 14 * 24 * 60,
      },
    );

    expect(result.outcome).toBe('HP_DEATH');
    expect(result.state.terminalReason).toBe('HEALTH_ZERO');
    expect(result.state.totalBarryPaid).toBeGreaterThan(0);
    expect(result.state.cash).toBeGreaterThan(0);
  });

  it('is deterministic for the same config, policy, outcome model and seed', () => {
    const makePolicy = (): FullGamePolicy => ({
      id: 'deterministic-script',
      decide: ({ state, counters }) => {
        if (state.pendingEventId !== null) {
          return { type: 'EVENT_CHOICE', choice: 'b' };
        }
        if (counters.plinkoDrops === 0) {
          return { type: 'PLINKO', fraction: 1 };
        }
        return { type: 'WAIT', minutes: 6 * 60 };
      },
    });

    const a = runFullGame(
      balance,
      makePolicy(),
      fixedPayoutModel(1_000_000),
      {
        seed: 404,
        configHash,
        maxGameMinutes: 3 * 24 * 60,
      },
    );
    const b = runFullGame(
      balance,
      makePolicy(),
      fixedPayoutModel(1_000_000),
      {
        seed: 404,
        configHash,
        maxGameMinutes: 3 * 24 * 60,
      },
    );

    expect(b).toEqual(a);
  });
});
