import type { BalanceConfig } from '../../src/config/balance.schema';
import {
  EVIDENCE_MODEL_ID,
  EVIDENCE_MODEL_NOTES,
} from './evidencePlinkoModel';
import type {
  FullGameRunResult,
} from './runner';

export interface TaggedFullGameRun {
  archetype: string;
  result: FullGameRunResult;
}

export interface UpgradeSequenceFrequency {
  sequence: string;
  count: number;
  share: number;
}

export interface StrategyBalanceSummary {
  archetype: string;
  policyId: string;
  runs: number;
  wins: number;
  barryLosses: number;
  hpDeaths: number;
  stepLimits: number;
  winRate: number;
  barryLossRate: number;
  hpDeathRate: number;
  medianVictoryElapsedDays: number | null;
  p10VictoryElapsedDays: number | null;
  p90VictoryElapsedDays: number | null;
  medianLossElapsedDays: number | null;
  medianRealSessionMinutes: number;
  medianVictoryRealMinutes: number | null;
  p10VictoryRealMinutes: number | null;
  p90VictoryRealMinutes: number | null;
  averageWorkShifts: number;
  averagePlinkoDrops: number;
  averageFoodActions: number;
  averageSleepActions: number;
  averageEntertainmentActions: number;
  averageEventsResolved: number;
  averageDumpsterSearches: number;
  dumpsterComebacks: number;
  dumpsterHpDeaths: number;
  nearZeroCashRecoveries: number;
  averageMaxBankrollDrawdown: number;
  p95MaxBankrollDrawdown: number;
  incomeShare: {
    work: number;
    plinko: number;
    dumpster: number;
  };
  shareWinsDominatedByOneGiantPayout: number;
  topUpgradeSequences: UpgradeSequenceFrequency[];
}

export interface AnomalySeed {
  archetype: string;
  policyId: string;
  seed: number;
  outcome: FullGameRunResult['outcome'];
  realSessionMinutes: number;
  reasons: string[];
}

export interface BalancePacingReport {
  metadata: {
    configVersion: string;
    configHash: string;
    codeRevision: string;
    runsPerPolicy: number;
    seedStart: number;
    realSecondsPerGameMinute: number;
    durationMetric: string;
    plinkoOutcomeModelId: string;
    plinkoModelNotes: readonly string[];
    nearZeroCashThreshold: number;
    giantPayoutDominanceThreshold: number;
  };
  strategies: StrategyBalanceSummary[];
  anomalySeeds: AnomalySeed[];
}

const mean = (values: readonly number[]): number =>
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) /
      values.length;

const quantile = (
  values: readonly number[],
  q: number,
): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const lowerValue = sorted[lower]!;
  const upperValue = sorted[upper]!;
  if (lower === upper) return lowerValue;
  return lowerValue + (upperValue - lowerValue) * (position - lower);
};

const ratio = (part: number, total: number): number =>
  total <= 0 ? 0 : part / total;

const realMinutes = (
  result: FullGameRunResult,
  config: BalanceConfig,
): number =>
  result.counters.gameMinutesAdvanced *
  config.time.realSecondsPerGameMinute /
  60;

const elapsedGameDays = (
  result: FullGameRunResult,
): number =>
  result.counters.gameMinutesAdvanced / (24 * 60);

const topUpgradeSequences = (
  results: readonly FullGameRunResult[],
): UpgradeSequenceFrequency[] => {
  const counts = new Map<string, number>();
  for (const result of results) {
    const sequence =
      result.diagnostics.upgradeOrder.length === 0
        ? '(none)'
        : result.diagnostics.upgradeOrder.join(' > ');
    counts.set(sequence, (counts.get(sequence) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([sequence, count]) => ({
      sequence,
      count,
      share: count / results.length,
    }))
    .sort((a, b) => b.count - a.count || a.sequence.localeCompare(b.sequence))
    .slice(0, 10);
};

const summarizeStrategy = (
  archetype: string,
  results: readonly FullGameRunResult[],
  config: BalanceConfig,
): StrategyBalanceSummary => {
  if (results.length === 0) {
    throw new Error(`No full-game runs for ${archetype}`);
  }

  const wins = results.filter((run) => run.outcome === 'VICTORY');
  const losses = results.filter((run) =>
    run.outcome === 'BARRY_LOSS' || run.outcome === 'HP_DEATH',
  );
  const barryLosses = results.filter(
    (run) => run.outcome === 'BARRY_LOSS',
  );
  const hpDeaths = results.filter(
    (run) => run.outcome === 'HP_DEATH',
  );
  const stepLimits = results.filter(
    (run) => run.outcome === 'STEP_LIMIT',
  );

  const workIncome = results.reduce(
    (sum, run) => sum + run.diagnostics.income.work,
    0,
  );
  const plinkoIncome = results.reduce(
    (sum, run) => sum + run.diagnostics.income.plinko,
    0,
  );
  const dumpsterIncome = results.reduce(
    (sum, run) => sum + run.diagnostics.income.dumpster,
    0,
  );
  const totalIncome = workIncome + plinkoIncome + dumpsterIncome;

  const giantDominatedWins = wins.filter((run) => {
    const runIncome =
      run.diagnostics.income.work +
      run.diagnostics.income.plinko +
      run.diagnostics.income.dumpster;
    return (
      runIncome > 0 &&
      run.diagnostics.largestPlinkoPayout >= runIncome * 0.5
    );
  });

  return {
    archetype,
    policyId: results[0]!.policyId,
    runs: results.length,
    wins: wins.length,
    barryLosses: barryLosses.length,
    hpDeaths: hpDeaths.length,
    stepLimits: stepLimits.length,
    winRate: wins.length / results.length,
    barryLossRate: barryLosses.length / results.length,
    hpDeathRate: hpDeaths.length / results.length,
    medianVictoryElapsedDays: quantile(
      wins.map(elapsedGameDays),
      0.5,
    ),
    p10VictoryElapsedDays: quantile(
      wins.map(elapsedGameDays),
      0.1,
    ),
    p90VictoryElapsedDays: quantile(
      wins.map(elapsedGameDays),
      0.9,
    ),
    medianLossElapsedDays: quantile(
      losses.map(elapsedGameDays),
      0.5,
    ),
    medianRealSessionMinutes:
      quantile(
        results.map((run) => realMinutes(run, config)),
        0.5,
      ) ?? 0,
    medianVictoryRealMinutes: quantile(
      wins.map((run) => realMinutes(run, config)),
      0.5,
    ),
    p10VictoryRealMinutes: quantile(
      wins.map((run) => realMinutes(run, config)),
      0.1,
    ),
    p90VictoryRealMinutes: quantile(
      wins.map((run) => realMinutes(run, config)),
      0.9,
    ),
    averageWorkShifts: mean(
      results.map((run) => run.counters.workShifts),
    ),
    averagePlinkoDrops: mean(
      results.map((run) => run.counters.plinkoDrops),
    ),
    averageFoodActions: mean(
      results.map((run) => run.counters.foodActions),
    ),
    averageSleepActions: mean(
      results.map((run) => run.counters.sleeps),
    ),
    averageEntertainmentActions: mean(
      results.map((run) => run.counters.entertainmentActions),
    ),
    averageEventsResolved: mean(
      results.map((run) => run.counters.eventsResolved),
    ),
    averageDumpsterSearches: mean(
      results.map((run) => run.counters.dumpsterSearches),
    ),
    dumpsterComebacks: results.reduce(
      (sum, run) => sum + run.diagnostics.dumpsterComebacks,
      0,
    ),
    dumpsterHpDeaths: results.reduce(
      (sum, run) => sum + run.diagnostics.dumpsterHpDeaths,
      0,
    ),
    nearZeroCashRecoveries: results.reduce(
      (sum, run) => sum + run.diagnostics.nearZeroCashRecoveries,
      0,
    ),
    averageMaxBankrollDrawdown: mean(
      results.map((run) => run.diagnostics.maxBankrollDrawdown),
    ),
    p95MaxBankrollDrawdown:
      quantile(
        results.map((run) => run.diagnostics.maxBankrollDrawdown),
        0.95,
      ) ?? 0,
    incomeShare: {
      work: ratio(workIncome, totalIncome),
      plinko: ratio(plinkoIncome, totalIncome),
      dumpster: ratio(dumpsterIncome, totalIncome),
    },
    shareWinsDominatedByOneGiantPayout:
      wins.length === 0
        ? 0
        : giantDominatedWins.length / wins.length,
    topUpgradeSequences: topUpgradeSequences(results),
  };
};

const anomalyReasons = (
  tagged: TaggedFullGameRun,
  config: BalanceConfig,
): string[] => {
  const { result } = tagged;
  const duration = realMinutes(result, config);
  const reasons: string[] = [];

  if (result.outcome === 'STEP_LIMIT') {
    reasons.push('step-limit');
  }
  if (
    result.outcome === 'VICTORY' &&
    duration < 15
  ) {
    reasons.push('victory-under-15-real-minutes');
  }
  if (
    result.outcome === 'VICTORY' &&
    duration > 45
  ) {
    reasons.push('victory-over-45-real-minutes');
  }
  if (result.diagnostics.dumpsterHpDeaths > 0) {
    reasons.push('dumpster-hp-death');
  }
  if (result.diagnostics.dumpsterComebacks >= 3) {
    reasons.push('three-plus-dumpster-comebacks');
  }

  const totalIncome =
    result.diagnostics.income.work +
    result.diagnostics.income.plinko +
    result.diagnostics.income.dumpster;
  if (
    result.outcome === 'VICTORY' &&
    totalIncome > 0 &&
    result.diagnostics.largestPlinkoPayout >= totalIncome * 0.5
  ) {
    reasons.push('giant-payout-dominated-win');
  }

  return reasons;
};

export const buildBalancePacingReport = (
  taggedRuns: readonly TaggedFullGameRun[],
  config: BalanceConfig,
  metadata: {
    configHash: string;
    codeRevision: string;
    runsPerPolicy: number;
    seedStart: number;
  },
): BalancePacingReport => {
  if (taggedRuns.length === 0) {
    throw new Error('Balance report requires at least one run');
  }

  const archetypes = [...new Set(
    taggedRuns.map((run) => run.archetype),
  )];

  const strategies = archetypes.map((archetype) =>
    summarizeStrategy(
      archetype,
      taggedRuns
        .filter((run) => run.archetype === archetype)
        .map((run) => run.result),
      config,
    ),
  );

  const anomalySeeds = taggedRuns
    .map((run) => ({
      run,
      reasons: anomalyReasons(run, config),
    }))
    .filter(({ reasons }) => reasons.length > 0)
    .map(({ run, reasons }) => ({
      archetype: run.archetype,
      policyId: run.result.policyId,
      seed: run.result.seed,
      outcome: run.result.outcome,
      realSessionMinutes: realMinutes(run.result, config),
      reasons,
    }));

  return {
    metadata: {
      configVersion: config.meta.version,
      configHash: metadata.configHash,
      codeRevision: metadata.codeRevision,
      runsPerPolicy: metadata.runsPerPolicy,
      seedStart: metadata.seedStart,
      realSecondsPerGameMinute: config.time.realSecondsPerGameMinute,
      durationMetric: 'Legacy *RealMinutes fields are game-clock equivalents including instantaneous action jumps; they are not measured wall-clock playtime.',
      plinkoOutcomeModelId: [...new Set(taggedRuns.map(run => run.result.plinkoOutcomeModelId))].join(' + '),
      plinkoModelNotes: taggedRuns.every(run => run.result.plinkoOutcomeModelId === EVIDENCE_MODEL_ID)
        ? EVIDENCE_MODEL_NOTES
        : taggedRuns.every(run => run.result.plinkoOutcomeModelId === 'matter-cascade-direct-v1')
          ? ['Each committed Drop uses the canonical Matter cascade and consumed RNG state; no heuristic payout tail.', 'Real session durations remain estimates; simulated skill failures do not establish human pacing.']
          : ['Custom or mixed diagnostic models; inspect the per-run model IDs before making balance claims.'],
      nearZeroCashThreshold:
        taggedRuns[0]!.result.diagnostics.nearZeroCashThreshold,
      giantPayoutDominanceThreshold: 0.5,
    },
    strategies,
    anomalySeeds,
  };
};
