import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { PhysicalRunnerMetrics } from './metrics';

export interface PhysicalReportMetadata {
  generatedAt: string;
  configVersion: string;
  configHash: string;
  codeRevision: string;
  engine: string;
  seed: number;
  runs: number;
}

export interface PhysicalReport {
  metadata: PhysicalReportMetadata;
  metrics: PhysicalRunnerMetrics;
}

export const hashConfig = (rawConfig: string): string =>
  createHash('sha256').update(rawConfig).digest('hex');

export const resolveGitRevision = (): string => {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return process.env.GITHUB_SHA ?? 'unknown';
  }
};

const percent = (value: number): string => `${(value * 100).toFixed(4)}%`;

const toMarkdown = (report: PhysicalReport): string => {
  const { metadata, metrics } = report;
  const pocketRows = metrics.pocketFrequencies
    .map(
      (frequency, index) =>
        `| ${index} | ${metrics.pocketCounts[index]} | ${percent(frequency)} |`,
    )
    .join('\n');

  return `# Bare Plinko physical calibration

## Provenance

- config version: \`${metadata.configVersion}\`
- config SHA-256: \`${metadata.configHash}\`
- code revision: \`${metadata.codeRevision}\`
- engine: \`${metadata.engine}\`
- seed: \`${metadata.seed}\`
- runs: \`${metadata.runs}\`
- generated: \`${metadata.generatedAt}\`

## Summary

- resolved: **${metrics.resolvedRuns}**
- stuck/watchdog: **${metrics.stuckRuns}** (${percent(metrics.stuckRate)})
- EV / RTP: **${metrics.ev.toFixed(6)}x**
- median: **${metrics.medianMultiplier.toFixed(4)}x**
- stddev: **${metrics.standardDeviation.toFixed(6)}**
- P(<1x): **${percent(metrics.probabilityBelow1x)}**
- P(>=2x): **${percent(metrics.probabilityAtLeast2x)}**
- P(>=5x): **${percent(metrics.probabilityAtLeast5x)}**
- P(>=10x): **${percent(metrics.probabilityAtLeast10x)}**
- edge/jackpot probability: **${percent(metrics.edgePocketProbability)}**
- p95 payout: **${metrics.p95Multiplier.toFixed(4)}x**
- p99 payout: **${metrics.p99Multiplier.toFixed(4)}x**
- mean collisions: **${metrics.meanCollisions.toFixed(3)}**
- mean cascade duration: **${metrics.meanCascadeSeconds.toFixed(3)} s**
- p95 cascade duration: **${metrics.p95CascadeSeconds.toFixed(3)} s**
- max cascade duration: **${metrics.maxCascadeSeconds.toFixed(3)} s**
- max mirrored-pocket frequency delta: **${percent(metrics.symmetryDelta)}**
- child-ball count: **${metrics.childBallCount}**
- Return count: **${metrics.returnCount}**

## Pocket frequencies

| Pocket | Count | Frequency |
| ---: | ---: | ---: |
${pocketRows}
`;
};

const toCsv = (report: PhysicalReport): string => {
  const header = 'pocket,count,frequency';
  const rows = report.metrics.pocketFrequencies.map(
    (frequency, index) =>
      `${index},${report.metrics.pocketCounts[index]},${frequency}`,
  );
  return [header, ...rows].join('\n') + '\n';
};

export const writePhysicalReport = (
  report: PhysicalReport,
  outputDirectory: string,
): void => {
  const absolute = resolve(outputDirectory);
  mkdirSync(absolute, { recursive: true });
  writeFileSync(resolve(absolute, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
  writeFileSync(resolve(absolute, 'pockets.csv'), toCsv(report));
  writeFileSync(resolve(absolute, 'REPORT.md'), toMarkdown(report));
};
