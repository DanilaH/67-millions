import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import {
  buildBalancePacingReport,
  type TaggedFullGameRun,
} from '../simulation/full-game/report';
import {
  runFullGame,
  type FullGamePolicy,
  type PlinkoOutcomeModel,
} from '../simulation/full-game/runner';

const debtPayoutModel: PlinkoOutcomeModel = {
  id: 'test-debt-payout',
  resolve: ({ state, pendingDrop }) => ({
    aggregatePayout: pendingDrop.originalStake + balance.game.mainDebt,
    nextRngState: (state.rngState + 1) >>> 0,
  }),
};

const zeroPayoutModel: PlinkoOutcomeModel = {
  id: 'test-zero-payout',
  resolve: ({ state }) => ({
    aggregatePayout: 0,
    nextRngState: (state.rngState + 1) >>> 0,
  }),
};

describe('full-game balance reporting', () => {
  it('records Plinko income, near-zero recovery, drawdown, and largest payout', () => {
    const policy: FullGamePolicy = {
      id: 'diagnostic-victory',
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
      debtPayoutModel,
      {
        seed: 501,
        configHash: 'hash',
      },
    );

    expect(result.outcome).toBe('VICTORY');
    expect(result.diagnostics.income.plinko).toBeGreaterThan(
      balance.game.mainDebt,
    );
    expect(result.diagnostics.largestPlinkoPayout).toBe(
      result.diagnostics.income.plinko,
    );
    expect(result.diagnostics.nearZeroCashRecoveries).toBe(1);
    expect(result.diagnostics.maxBankrollDrawdown).toBeGreaterThan(0);
    expect(result.diagnostics.minCash).toBe(0);
  });

  it('records upgrade purchase order in the runner result', () => {
    const policy: FullGamePolicy = {
      id: 'upgrade-order',
      decide: ({ counters }) =>
        counters.purchases === 0
          ? { type: 'BUY_PLINKO_MAX_BET' }
          : { type: 'STOP' },
    };

    const result = runFullGame(
      balance,
      policy,
      zeroPayoutModel,
      {
        seed: 502,
        configHash: 'hash',
      },
    );

    expect(result.outcome).toBe('STOPPED');
    expect(result.diagnostics.upgradeOrder).toEqual([
      'plinko:maxBet:L1',
    ]);
  });

  it('aggregates outcome, pacing, income-source, and anomaly metrics', () => {
    const victoryPolicy: FullGamePolicy = {
      id: 'report-victory',
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
    const lossPolicy: FullGamePolicy = {
      id: 'report-loss',
      decide: ({ state }) =>
        state.pendingEventId !== null
          ? { type: 'EVENT_CHOICE', choice: 'b' }
          : { type: 'WAIT', minutes: 24 * 60 },
    };

    const victory = runFullGame(
      balance,
      victoryPolicy,
      debtPayoutModel,
      {
        seed: 503,
        configHash: 'hash',
      },
    );
    const loss = runFullGame(
      balance,
      lossPolicy,
      zeroPayoutModel,
      {
        seed: 504,
        configHash: 'hash',
        maxGameMinutes: 3 * 24 * 60,
      },
    );

    const tagged: TaggedFullGameRun[] = [
      { archetype: 'TEST', result: victory },
      { archetype: 'TEST', result: loss },
    ];

    const report = buildBalancePacingReport(
      tagged,
      balance,
      {
        configHash: 'hash',
        codeRevision: 'test-revision',
        runsPerPolicy: 2,
        seedStart: 503,
      },
    );

    expect(report.strategies).toHaveLength(1);
    expect(report.strategies[0]?.runs).toBe(2);
    expect(report.strategies[0]?.winRate).toBe(0.5);
    expect(report.strategies[0]?.barryLossRate).toBe(0.5);
    expect(report.strategies[0]?.incomeShare.plinko).toBeGreaterThan(0);
    expect(report.metadata.plinkoModelNotes.length).toBeGreaterThan(0);
    expect(
      report.anomalySeeds.some(
        (entry) => entry.seed === victory.seed,
      ),
    ).toBe(true);
  });
});
