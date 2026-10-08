import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseBalanceConfig } from '../../src/config/balance';

// Reuse isolated probes only for price/cap experiments, never physics changes.
const [sourceConfig, sourceCache, targetConfig, targetCache] = process.argv.slice(2);
if (!sourceConfig || !sourceCache || !targetConfig || !targetCache) throw Error('Expected source config/cache and target config/cache');
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const load = (path: string) => parseBalanceConfig(JSON.parse(readFileSync(path, 'utf8')));
const source = load(sourceConfig), target = load(targetConfig);
const project = (config: typeof source) => {
  const copy = structuredClone(config);
  copy.plinko.maxBetLevels = copy.plinko.maxBetLevels.slice(0, 1);
  const strip = (value: unknown): unknown => Array.isArray(value) ? value.map(strip)
    : value !== null && typeof value === 'object' ? Object.fromEntries(Object.entries(value)
      .filter(([key]) => key !== 'price' && key !== 'meta').map(([key, child]) => [key, strip(child)])) : value;
  return JSON.stringify(strip(copy));
};
if (project(source) !== project(target)) throw Error('Probe configs differ beyond prices/noninitial caps');
const saved = JSON.parse(readFileSync(sourceCache, 'utf8'));
if (saved.identity.configHash !== hash(JSON.stringify(source)) || saved.identity.count !== 128
  || saved.identity.seedStart !== 67146000 || saved.identity.model !== 'normalized-paired-single-root-capacity-proxy-v2') {
  throw Error('Unexpected source probe provenance');
}
mkdirSync(dirname(targetCache), { recursive: true });
writeFileSync(targetCache, JSON.stringify({ identity: { ...saved.identity, configHash: hash(JSON.stringify(target)) },
  measurements: saved.measurements }, null, 2) + '\n');
writeFileSync(targetCache + '.bootstrap.json', JSON.stringify({ sourceConfig, sourceCache,
  sourceConfigHash: hash(readFileSync(sourceConfig, 'utf8')), sourceCacheHash: hash(readFileSync(sourceCache, 'utf8')),
  targetConfigHash: hash(readFileSync(targetConfig, 'utf8')), projectionHash: hash(project(source)),
  boardsPreloaded: Object.keys(saved.measurements).length, count: saved.identity.count,
  seedStart: saved.identity.seedStart, model: saved.identity.model,
  limitations: 'Reused probes are not new executions. Ranking seeds reused; full-game seeds must be fresh.' }, null, 2) + '\n');
console.log('Verified reusable boards:', Object.keys(saved.measurements).length);
