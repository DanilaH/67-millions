import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { parseBalanceConfig } from '../../src/config/balance';
import {
  runFullGame,
  type FullGamePolicy,
  type PlinkoOutcomeModel,
} from './runner';

type SmokeScenario = 'victory' | 'barry-loss' | 'hp-death';

interface CliOptions {
  scenario: SmokeScenario;
  seed: number;
}

const parseArgs = (argv: readonly string[]): CliOptions => {
  const options: CliOptions = {
    scenario: 'barry-loss',
    seed: 67_000_000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];

    if (key === '--scenario') {
      const value = argv[++index];
      if (
        value !== 'victory' &&
        value !== 'barry-loss' &&
        value !== 'hp-death'
      ) {
        throw new Error(
          '--scenario must be victory, barry-loss, or hp-death',
        );
      }
      options.scenario = value;
      continue;
    }

    if (key === '--seed') {
      const value = Number(argv[++index]);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error('--seed must be a positive integer');
      }
      options.seed = value;
      continue;
    }

    throw new Error(`Unknown argument: ${key}`);
  }

  return options;
};

const createSmokePolicy = (
  scenario: SmokeScenario,
): FullGamePolicy => ({
  id: `smoke-${scenario}`,
  decide: ({ state, counters }) => {
    if (state.pendingEventId !== null) {
      return {
        type: 'EVENT_CHOICE',
        choice: scenario === 'barry-loss' ? 'b' : 'a',
      };
    }

    if (scenario === 'victory') {
      return counters.plinkoDrops === 0
        ? { type: 'PLINKO', fraction: 1 }
        : { type: 'PAY_MAIN_DEBT' };
    }

    if (scenario === 'hp-death' && counters.plinkoDrops === 0) {
      return { type: 'PLINKO', fraction: 1 };
    }

    return { type: 'WAIT', minutes: 12 * 60 };
  },
});

const createSmokePlinkoModel = (
  scenario: SmokeScenario,
  mainDebt: number,
): PlinkoOutcomeModel => ({
  id: `smoke-${scenario}`,
  resolve: ({ state }) => ({
    aggregatePayout:
      scenario === 'victory'
        ? mainDebt
        : scenario === 'hp-death'
          ? 10_000_000
          : 0,
    nextRngState: (state.rngState + 1) >>> 0,
  }),
});

const options = parseArgs(process.argv.slice(2));
const rawConfig = readFileSync(
  new URL('../../balance.v0.json', import.meta.url),
  'utf8',
);
const config = parseBalanceConfig(JSON.parse(rawConfig));
const configHash = createHash('sha256')
  .update(rawConfig)
  .digest('hex');

const result = runFullGame(
  config,
  createSmokePolicy(options.scenario),
  createSmokePlinkoModel(options.scenario, config.game.mainDebt),
  {
    seed: options.seed,
    configHash,
    maxGameMinutes:
      options.scenario === 'hp-death'
        ? 14 * 24 * 60
        : 3 * 24 * 60,
  },
);

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
