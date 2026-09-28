import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { balance } from '../../src/config/balance';
import {
  derivePocketMultipliers,
  type PocketUpgradeLevels,
  type SpecialUpgradeLevels,
} from '../../src/core/plinko-rules/progression';
import { runCascadePhysicalDrops } from './cascadeRunner';
import { summarizeCascadeDrops } from './cascadeMetrics';

interface CliOptions {
  runs: number;
  seed: number;
  output: string;
  stake: number;
  centerLevel: number;
  midLevel: number;
  jackpotLevel: number;
  amplifierLevel: number;
  returnLevel: number;
  splitterLevel: number;
  jackpotBiasLevel: number;
}

const positiveInt = (
  value: string | undefined,
  name: string,
): number => {
  if (value === undefined) throw new Error(`Missing ${name}`);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
};

const nonNegativeInt = (
  value: string | undefined,
  name: string,
): number => {
  if (value === undefined) throw new Error(`Missing ${name}`);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
};

const parseArgs = (argv: readonly string[]): CliOptions => {
  const options: CliOptions = {
    runs: 5_000,
    seed: 67_035_000,
    output: 'artifacts/plinko/cascade',
    stake: 100_000,
    centerLevel: 0,
    midLevel: 0,
    jackpotLevel: 0,
    amplifierLevel: 0,
    returnLevel: 0,
    splitterLevel: 0,
    jackpotBiasLevel: 0,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];

    if (key === '--runs') {
      options.runs = positiveInt(argv[++index], key);
    } else if (key === '--seed') {
      options.seed = positiveInt(argv[++index], key);
    } else if (key === '--stake') {
      options.stake = positiveInt(argv[++index], key);
    } else if (key === '--center-level') {
      options.centerLevel = nonNegativeInt(argv[++index], key);
    } else if (key === '--mid-level') {
      options.midLevel = nonNegativeInt(argv[++index], key);
    } else if (key === '--jackpot-level') {
      options.jackpotLevel = nonNegativeInt(argv[++index], key);
    } else if (key === '--amplifier-level') {
      options.amplifierLevel = nonNegativeInt(argv[++index], key);
    } else if (key === '--return-level') {
      options.returnLevel = nonNegativeInt(argv[++index], key);
    } else if (key === '--splitter-level') {
      options.splitterLevel = nonNegativeInt(argv[++index], key);
    } else if (key === '--jackpot-bias-level') {
      options.jackpotBiasLevel = nonNegativeInt(argv[++index], key);
    } else if (key === '--output') {
      const value = argv[++index];
      if (!value) throw new Error('Missing --output value');
      options.output = value;
    } else {
      throw new Error(`Unknown argument: ${key}`);
    }
  }

  return options;
};

const options = parseArgs(process.argv.slice(2));

const pocketLevels: PocketUpgradeLevels = {
  centerLevel: options.centerLevel,
  midLevel: options.midLevel,
  jackpotLevel: options.jackpotLevel,
};
const specialLevels: SpecialUpgradeLevels = {
  amplifierLevel: options.amplifierLevel,
  returnLevel: options.returnLevel,
  splitterLevel: options.splitterLevel,
  jackpotBiasLevel: options.jackpotBiasLevel,
};
const pocketMultipliers = derivePocketMultipliers(
  balance,
  pocketLevels,
);

const samples = runCascadePhysicalDrops(balance, {
  runs: options.runs,
  seed: options.seed,
  stake: options.stake,
  pocketMultipliers,
  specialLevels,
});
const metrics = summarizeCascadeDrops(balance, samples);
const stuckDiagnostics = samples.flatMap((sample, dropIndex) =>
  sample.stuck
    ? [{
        dropIndex,
        balls: sample.stuckBalls,
      }]
    : [],
);

const boardHash = createHash('sha256')
  .update(
    JSON.stringify({
      geometry: balance.plinko.geometry,
      physics: balance.plinko.physicsSeed,
      splitterPhysics: balance.plinko.splitterPhysics,
      specialPinLayout: balance.plinko.specialPinLayout,
      pocketLevels,
      specialLevels,
      pocketMultipliers,
    }),
  )
  .digest('hex');

const report = {
  metadata: {
    generatedAt: new Date().toISOString(),
    runs: options.runs,
    seed: options.seed,
    stake: options.stake,
    boardHash,
    pocketLevels,
    specialLevels,
    pocketMultipliers,
    ballBallCollisions: balance.plinko.ballBallCollisions,
  },
  metrics,
  stuckDiagnostics,
};

const percent = (value: number): string =>
  `${(value * 100).toFixed(3)}%`;

const markdown = `# Plinko cascade physical report

## Provenance

- runs: **${options.runs}**
- seed: **${options.seed}**
- representative stake: **${options.stake.toLocaleString('en-US')}**
- board hash: \`${boardHash}\`
- pocket levels: center L${options.centerLevel}, mid L${options.midLevel}, jackpot L${options.jackpotLevel}
- special levels: amplifier L${options.amplifierLevel}, return L${options.returnLevel}, splitter L${options.splitterLevel}, Jackpot Bias L${options.jackpotBiasLevel}
- ball-ball collisions: **${balance.plinko.ballBallCollisions ? 'enabled' : 'disabled'}**

## Aggregate outcome

- resolved: **${metrics.resolvedRuns} / ${metrics.runs}**
- stuck/watchdog: **${metrics.stuckRuns}** (${percent(metrics.stuckRate)})
- EV / RTP: **${metrics.ev.toFixed(6)}x**
- median: **${metrics.medianMultiplier.toFixed(6)}x**
- stddev: **${metrics.standardDeviation.toFixed(6)}**
- P(<1x): **${percent(metrics.probabilityBelow1x)}**
- P(>=2x): **${percent(metrics.probabilityAtLeast2x)}**
- P(>=5x): **${percent(metrics.probabilityAtLeast5x)}**
- P(>=10x): **${percent(metrics.probabilityAtLeast10x)}**

## Cascade load

- mean terminal balls: **${metrics.meanTerminalBalls.toFixed(4)}**
- mean child balls created: **${metrics.meanChildBalls.toFixed(4)}**
- mean Returns: **${metrics.meanReturns.toFixed(4)}**
- mean Amplifier procs: **${metrics.meanAmplifierProcs.toFixed(4)}**
- mean max-active balls: **${metrics.meanMaxActiveBalls.toFixed(4)}**
- max active balls observed: **${metrics.maxActiveBalls}**
- mean duration: **${metrics.meanCascadeSeconds.toFixed(3)}s**
- p95 duration: **${metrics.p95CascadeSeconds.toFixed(3)}s**
- max duration: **${metrics.maxCascadeSeconds.toFixed(3)}s**

## Watchdog diagnostics

${stuckDiagnostics.length === 0
  ? '- none'
  : stuckDiagnostics.map((entry) =>
      `- Drop ${entry.dropIndex}: ${entry.balls.map((ball) =>
        `${ball.ballId} @ (${ball.x.toFixed(3)}, ${ball.y.toFixed(3)}) v=(${ball.velocityX.toFixed(5)}, ${ball.velocityY.toFixed(5)})`
      ).join('; ')}
`).join('')}
`;

const out = resolve(options.output);
mkdirSync(out, { recursive: true });
writeFileSync(
  resolve(out, 'summary.json'),
  JSON.stringify(report, null, 2) + '\n',
);
writeFileSync(resolve(out, 'REPORT.md'), markdown);

process.stdout.write(JSON.stringify(report, null, 2) + '\n');

if (metrics.stuckRuns > 0) {
  process.exitCode = 2;
}
