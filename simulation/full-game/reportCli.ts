import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseBalanceConfig } from '../../src/config/balance';
import {
  BASELINE_ARCHETYPES,
  createBaselinePolicy,
} from './policies';
import {
  HIGH_VARIANCE_ARCHETYPES,
  createHighVariancePolicy,
} from './highVariancePolicies';
import {
  createEvidenceDerivedPlinkoModel,
} from './evidencePlinkoModel';
import {
  buildBalancePacingReport,
  type BalancePacingReport,
  type StrategyBalanceSummary,
  type TaggedFullGameRun,
} from './report';
import { runFullGame } from './runner';
import {
  hashConfig,
  resolveGitRevision,
} from '../plinko/report';

interface CliOptions {
  runsPerPolicy: number;
  seedStart: number;
  output: string;
}

const parsePositiveInteger = (
  value: string | undefined,
  name: string,
): number => {
  if (value === undefined) throw new Error(`Missing value for ${name}`);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
};

const parseArgs = (argv: readonly string[]): CliOptions => {
  const options: CliOptions = {
    runsPerPolicy: 100,
    seedStart: 67_100_000,
    output: 'artifacts/full-game/t048',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];

    if (key === '--runs-per-policy') {
      options.runsPerPolicy = parsePositiveInteger(
        argv[++index],
        '--runs-per-policy',
      );
    } else if (key === '--seed-start') {
      options.seedStart = parsePositiveInteger(
        argv[++index],
        '--seed-start',
      );
    } else if (key === '--output') {
      const value = argv[++index];
      if (!value) throw new Error('Missing value for --output');
      options.output = value;
    } else {
      throw new Error(`Unknown argument: ${key}`);
    }
  }

  return options;
};

const csvNumber = (value: number | null): string =>
  value === null ? '' : String(value);

const strategyCsv = (
  strategies: readonly StrategyBalanceSummary[],
): string => {
  const header = [
    'archetype',
    'policyId',
    'runs',
    'winRate',
    'barryLossRate',
    'hpDeathRate',
    'medianVictoryElapsedDays',
    'p10VictoryElapsedDays',
    'p90VictoryElapsedDays',
    'medianLossElapsedDays',
    'medianRealSessionMinutes',
    'medianVictoryRealMinutes',
    'averageWorkShifts',
    'averagePlinkoDrops',
    'averageFoodActions',
    'averageSleepActions',
    'averageEntertainmentActions',
    'averageEventsResolved',
    'averageDumpsterSearches',
    'dumpsterComebacks',
    'dumpsterHpDeaths',
    'nearZeroCashRecoveries',
    'averageMaxBankrollDrawdown',
    'p95MaxBankrollDrawdown',
    'incomeShareWork',
    'incomeSharePlinko',
    'incomeShareDumpster',
    'shareWinsDominatedByOneGiantPayout',
  ];

  const rows = strategies.map((strategy) => [
    strategy.archetype,
    strategy.policyId,
    strategy.runs,
    strategy.winRate,
    strategy.barryLossRate,
    strategy.hpDeathRate,
    csvNumber(strategy.medianVictoryElapsedDays),
    csvNumber(strategy.p10VictoryElapsedDays),
    csvNumber(strategy.p90VictoryElapsedDays),
    csvNumber(strategy.medianLossElapsedDays),
    strategy.medianRealSessionMinutes,
    csvNumber(strategy.medianVictoryRealMinutes),
    strategy.averageWorkShifts,
    strategy.averagePlinkoDrops,
    strategy.averageFoodActions,
    strategy.averageSleepActions,
    strategy.averageEntertainmentActions,
    strategy.averageEventsResolved,
    strategy.averageDumpsterSearches,
    strategy.dumpsterComebacks,
    strategy.dumpsterHpDeaths,
    strategy.nearZeroCashRecoveries,
    strategy.averageMaxBankrollDrawdown,
    strategy.p95MaxBankrollDrawdown,
    strategy.incomeShare.work,
    strategy.incomeShare.plinko,
    strategy.incomeShare.dumpster,
    strategy.shareWinsDominatedByOneGiantPayout,
  ].join(','));

  return [header.join(','), ...rows].join('\n') + '\n';
};

const anomalyCsv = (
  report: BalancePacingReport,
): string => {
  const header = 'archetype,policyId,seed,outcome,realSessionMinutes,reasons';
  const rows = report.anomalySeeds.map((anomaly) =>
    [
      anomaly.archetype,
      anomaly.policyId,
      anomaly.seed,
      anomaly.outcome,
      anomaly.realSessionMinutes,
      anomaly.reasons.join('|'),
    ].join(','),
  );
  return [header, ...rows].join('\n') + '\n';
};

const percent = (value: number): string =>
  `${(value * 100).toFixed(1)}%`;

const metric = (value: number | null, digits = 2): string =>
  value === null ? 'n/a' : value.toFixed(digits);

const markdown = (report: BalancePacingReport): string => {
  const rows = report.strategies
    .map((strategy) =>
      [
        strategy.archetype,
        percent(strategy.winRate),
        percent(strategy.barryLossRate),
        percent(strategy.hpDeathRate),
        metric(strategy.medianVictoryRealMinutes, 1),
        strategy.averageWorkShifts.toFixed(1),
        strategy.averagePlinkoDrops.toFixed(1),
        strategy.averageDumpsterSearches.toFixed(1),
        percent(strategy.incomeShare.work),
        percent(strategy.incomeShare.plinko),
        percent(strategy.incomeShare.dumpster),
      ].map((value) => `| ${value} `).join('') + '|',
    )
    .join('\n');

  const anomalyLines =
    report.anomalySeeds.length === 0
      ? '- none under the configured diagnostic rules'
      : report.anomalySeeds
          .slice(0, 50)
          .map(
            (anomaly) =>
              `- ${anomaly.archetype} seed \`${anomaly.seed}\`: ${anomaly.reasons.join(', ')}`,
          )
          .join('\n');

  const modelNotes = report.metadata.plinkoModelNotes
    .map((note) => `- ${note}`)
    .join('\n');

  return `# T048 — Full-game balance / pacing report

## Provenance

- config version: \`${report.metadata.configVersion}\`
- config SHA-256: \`${report.metadata.configHash}\`
- code revision: \`${report.metadata.codeRevision}\`
- runs per policy: **${report.metadata.runsPerPolicy}**
- seed start: **${report.metadata.seedStart}**
- Plinko economy model: \`${report.metadata.plinkoOutcomeModelId}\`
- near-zero cash threshold: **${report.metadata.nearZeroCashThreshold} ₽**
- giant-payout-dominated win threshold: **${percent(report.metadata.giantPayoutDominanceThreshold)} of credited modeled income**

## Measurement caveat

This is an **economy/pacing diagnostic**, not final physical Plinko balance evidence. The full-game runner is pure core and the Plinko model is evidence-derived:

${modelNotes}

Upgrade prices and final economy remain tunable until later large-batch + playtest gates.

## Strategy summary

| Policy | Win | Barry loss | HP death | Median win real min | Avg work | Avg Drops | Avg dumpster | Work income | Plinko income | Dumpster income |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows}

## Per-policy details

${report.strategies.map((strategy) => `### ${strategy.archetype}

- median victory elapsed days: **${metric(strategy.medianVictoryElapsedDays)}**
- p10 / p90 victory elapsed days: **${metric(strategy.p10VictoryElapsedDays)} / ${metric(strategy.p90VictoryElapsedDays)}**
- median loss elapsed days: **${metric(strategy.medianLossElapsedDays)}**
- median real-session proxy: **${strategy.medianRealSessionMinutes.toFixed(1)} min**
- median / p10 / p90 victory real minutes: **${metric(strategy.medianVictoryRealMinutes, 1)} / ${metric(strategy.p10VictoryRealMinutes, 1)} / ${metric(strategy.p90VictoryRealMinutes, 1)}**
- average food / sleep / entertainment / events: **${strategy.averageFoodActions.toFixed(1)} / ${strategy.averageSleepActions.toFixed(1)} / ${strategy.averageEntertainmentActions.toFixed(1)} / ${strategy.averageEventsResolved.toFixed(1)}**
- dumpster comebacks / HP deaths: **${strategy.dumpsterComebacks} / ${strategy.dumpsterHpDeaths}**
- near-zero cash recoveries: **${strategy.nearZeroCashRecoveries}**
- average / p95 max bankroll drawdown: **${strategy.averageMaxBankrollDrawdown.toFixed(0)} / ${strategy.p95MaxBankrollDrawdown.toFixed(0)} ₽**
- wins dominated by one giant payout: **${percent(strategy.shareWinsDominatedByOneGiantPayout)}**
- top upgrade sequences: ${strategy.topUpgradeSequences.map((entry) => `\`${entry.sequence}\` (${entry.count})`).join('; ')}
`).join('\n')}

## Anomaly seeds

${anomalyLines}
`;
};

const options = parseArgs(process.argv.slice(2));
const rawConfig = readFileSync(
  new URL('../../balance.v0.json', import.meta.url),
  'utf8',
);
const config = parseBalanceConfig(JSON.parse(rawConfig));
const configHash = hashConfig(rawConfig);
const codeRevision = resolveGitRevision();
const model = createEvidenceDerivedPlinkoModel();

const taggedRuns: TaggedFullGameRun[] = [];
const allArchetypes = [
  ...BASELINE_ARCHETYPES,
  ...HIGH_VARIANCE_ARCHETYPES,
] as const;

let seed = options.seedStart;
for (const archetype of allArchetypes) {
  for (let runIndex = 0; runIndex < options.runsPerPolicy; runIndex += 1) {
    const runSeed = seed++;
    const policy =
      archetype === 'DEGENERATE' ||
      archetype === 'RECKLESS_NEEDS'
        ? createHighVariancePolicy(config, archetype, runSeed)
        : createBaselinePolicy(config, archetype, runSeed);

    taggedRuns.push({
      archetype,
      result: runFullGame(
        config,
        policy,
        model,
        {
          seed: runSeed,
          configHash,
          maxDecisions: 20_000,
          maxGameMinutes: 35 * 24 * 60,
        },
      ),
    });
  }
}

const report = buildBalancePacingReport(
  taggedRuns,
  config,
  {
    configHash,
    codeRevision,
    runsPerPolicy: options.runsPerPolicy,
    seedStart: options.seedStart,
  },
);

const output = resolve(options.output);
mkdirSync(output, { recursive: true });
writeFileSync(
  resolve(output, 'summary.json'),
  JSON.stringify(report, null, 2) + '\n',
);
writeFileSync(
  resolve(output, 'strategies.csv'),
  strategyCsv(report.strategies),
);
writeFileSync(
  resolve(output, 'anomaly-seeds.csv'),
  anomalyCsv(report),
);
writeFileSync(
  resolve(output, 'REPORT.md'),
  markdown(report),
);

process.stdout.write(JSON.stringify(report, null, 2) + '\n');
