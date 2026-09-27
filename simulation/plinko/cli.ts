import { readFileSync } from 'node:fs';

import { parseBalanceConfig } from '../../src/config/balance';
import { summarizePhysicalDrops } from './metrics';
import { runBarePhysicalDrops } from './physicalRunner';
import {
  hashConfig,
  resolveGitRevision,
  writePhysicalReport,
  type PhysicalReport,
} from './report';

interface CliOptions {
  runs: number;
  seed: number;
  batchSize: number;
  output: string;
}

const parseInteger = (value: string | undefined, name: string): number => {
  if (value === undefined) throw new Error(`Missing value for ${name}`);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
};

const parseArgs = (argv: readonly string[]): CliOptions => {
  const options: CliOptions = {
    runs: 100_000,
    seed: 67_000_000,
    batchSize: 256,
    output: 'artifacts/plinko/bare',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === '--runs') options.runs = parseInteger(argv[++index], '--runs');
    else if (key === '--seed') options.seed = parseInteger(argv[++index], '--seed');
    else if (key === '--batch-size') options.batchSize = parseInteger(argv[++index], '--batch-size');
    else if (key === '--output') {
      const value = argv[++index];
      if (!value) throw new Error('Missing value for --output');
      options.output = value;
    } else {
      throw new Error(`Unknown argument: ${key}`);
    }
  }

  return options;
};

const options = parseArgs(process.argv.slice(2));
const rawConfig = readFileSync(new URL('../../balance.v0.json', import.meta.url), 'utf8');
const config = parseBalanceConfig(JSON.parse(rawConfig));

const samples = runBarePhysicalDrops(config, {
  runs: options.runs,
  seed: options.seed,
  batchSize: options.batchSize,
});
const metrics = summarizePhysicalDrops(config, samples);

const report: PhysicalReport = {
  metadata: {
    generatedAt: new Date().toISOString(),
    configVersion: config.meta.version,
    configHash: hashConfig(rawConfig),
    codeRevision: resolveGitRevision(),
    engine: 'matter-js@0.20.0 (Phaser Matter baseline)',
    seed: options.seed,
    runs: options.runs,
  },
  metrics,
};

writePhysicalReport(report, options.output);
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
