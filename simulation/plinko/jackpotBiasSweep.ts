import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { balance } from '../../src/config/balance';
import { runBarePhysicalDrops } from './physicalRunner';
import { summarizePhysicalDrops } from './metrics';

const runs = Number(process.env.PLINKO_BIAS_SWEEP_RUNS ?? 10_000);
const seed = Number(process.env.PLINKO_BIAS_SWEEP_SEED ?? 67_036_000);
const output = process.env.PLINKO_BIAS_SWEEP_OUTPUT;

const rows = [];

for (
  let jackpotBiasLevel = 0;
  jackpotBiasLevel <= balance.plinko.jackpotBias.length;
  jackpotBiasLevel += 1
) {
  const samples = runBarePhysicalDrops(balance, {
    runs,
    seed,
    batchSize: 256,
    jackpotBiasLevel,
  });
  const metrics = summarizePhysicalDrops(balance, samples);

  rows.push({
    jackpotBiasLevel,
    deflectorPairCount:
      jackpotBiasLevel === 0
        ? 0
        : balance.plinko.jackpotBias[jackpotBiasLevel - 1]!.deflectorPairs.length,
    ev: metrics.ev,
    edgePocketProbability: metrics.edgePocketProbability,
    combinedCenterProbability: metrics.combinedCenterProbability,
    symmetryDelta: metrics.symmetryDelta,
    stuckRate: metrics.stuckRate,
    meanCascadeSeconds: metrics.meanCascadeSeconds,
    p95CascadeSeconds: metrics.p95CascadeSeconds,
    maxCascadeSeconds: metrics.maxCascadeSeconds,
    pocketFrequencies: metrics.pocketFrequencies,
  });
}

const report = { runs, seed, rows };
process.stdout.write(JSON.stringify(report, null, 2) + '\n');

if (output) {
  const out = resolve(output);
  mkdirSync(out, { recursive: true });
  writeFileSync(
    resolve(out, 'summary.json'),
    JSON.stringify(report, null, 2) + '\n',
  );

  const markdown = [
    '# Jackpot Bias physical sweep',
    '',
    `- runs per level: **${runs.toLocaleString('en-US')}**`,
    `- seed: **${seed}**`,
    '',
    '| Level | Pairs | Edge probability | EV | Symmetry delta | Stuck | p95 | Max |',
    '| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows.map(
      (row) =>
        `| L${row.jackpotBiasLevel} | ${row.deflectorPairCount} | ${(row.edgePocketProbability * 100).toFixed(3)}% | ${row.ev.toFixed(6)}x | ${(row.symmetryDelta * 100).toFixed(3)}% | ${(row.stuckRate * 100).toFixed(3)}% | ${row.p95CascadeSeconds.toFixed(3)}s | ${row.maxCascadeSeconds.toFixed(3)}s |`,
    ),
    '',
  ].join('\n');

  writeFileSync(resolve(out, 'REPORT.md'), markdown);
}

const hasStuck = rows.some((row) => row.stuckRate > 0);
const nonMonotonicEdge = rows
  .slice(1)
  .some(
    (row, index) =>
      row.edgePocketProbability <=
      rows[index]!.edgePocketProbability,
  );

if (hasStuck || nonMonotonicEdge) {
  process.exitCode = 2;
}
