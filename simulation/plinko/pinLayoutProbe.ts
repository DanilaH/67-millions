import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { balance } from '../../src/config/balance';
import { deriveBarePlinkoLayout } from '../../src/core/plinko-rules/boardLayout';
import { runBarePhysicalDrops } from './physicalRunner';

interface PegStat {
  index: number;
  id: string;
  row: number;
  column: number;
  x: number;
  y: number;
  hitDrops: number;
  hitRate: number;
}

interface PairStat {
  id: string;
  leftId: string;
  rightId: string;
  row: number;
  leftColumn: number;
  rightColumn: number;
  hitDrops: number;
  hitRate: number;
}

const RUNS = Number(process.env.PLINKO_PIN_PROBE_RUNS ?? 100_000);
const SEED = Number(process.env.PLINKO_PIN_PROBE_SEED ?? 67_034_000);
const OUTPUT = process.env.PLINKO_PIN_PROBE_OUTPUT ?? 'artifacts/plinko/pin-layout-probe';

if (!Number.isInteger(RUNS) || RUNS <= 0) throw new Error('PLINKO_PIN_PROBE_RUNS must be a positive integer');
if (!Number.isInteger(SEED) || SEED <= 0) throw new Error('PLINKO_PIN_PROBE_SEED must be a positive integer');

const layout = deriveBarePlinkoLayout(balance);
const samples = runBarePhysicalDrops(balance, {
  runs: RUNS,
  seed: SEED,
  batchSize: 256,
  trackPegHits: true,
});

const pegHitCounts = Array.from({ length: layout.pegs.length }, () => 0);
const pairDefinitions = new Map<string, { indices: [number, number]; row: number; leftColumn: number; rightColumn: number }>();

for (const peg of layout.pegs) {
  const mirrorColumn = peg.row - peg.column;
  const mirror = layout.pegs.find(
    (candidate) => candidate.row === peg.row && candidate.column === mirrorColumn,
  );
  if (!mirror) throw new Error(`Missing mirror for ${peg.id}`);

  const left = peg.column <= mirror.column ? peg : mirror;
  const right = peg.column <= mirror.column ? mirror : peg;
  const key = left.index === right.index ? left.id : `${left.id}+${right.id}`;

  if (!pairDefinitions.has(key)) {
    pairDefinitions.set(key, {
      indices: [left.index, right.index],
      row: peg.row,
      leftColumn: left.column,
      rightColumn: right.column,
    });
  }
}

const pairHitCounts = new Map<string, number>(
  Array.from(pairDefinitions.keys(), (key) => [key, 0]),
);

for (const sample of samples) {
  const hits = new Set(sample.pegHitIndices ?? []);

  for (const index of hits) {
    pegHitCounts[index] = (pegHitCounts[index] ?? 0) + 1;
  }

  for (const [key, definition] of pairDefinitions) {
    if (hits.has(definition.indices[0]) || hits.has(definition.indices[1])) {
      pairHitCounts.set(key, (pairHitCounts.get(key) ?? 0) + 1);
    }
  }
}

const pegs: PegStat[] = layout.pegs.map((peg) => ({
  index: peg.index,
  id: peg.id,
  row: peg.row,
  column: peg.column,
  x: peg.x,
  y: peg.y,
  hitDrops: pegHitCounts[peg.index] ?? 0,
  hitRate: (pegHitCounts[peg.index] ?? 0) / RUNS,
}));

const pairs: PairStat[] = Array.from(pairDefinitions, ([id, definition]) => {
  const left = layout.pegs[definition.indices[0]]!;
  const right = layout.pegs[definition.indices[1]]!;
  const hitDrops = pairHitCounts.get(id) ?? 0;

  return {
    id,
    leftId: left.id,
    rightId: right.id,
    row: definition.row,
    leftColumn: definition.leftColumn,
    rightColumn: definition.rightColumn,
    hitDrops,
    hitRate: hitDrops / RUNS,
  };
});

const sortedPegs = [...pegs].sort((a, b) => b.hitRate - a.hitRate);
const sortedPairs = [...pairs].sort((a, b) => b.hitRate - a.hitRate);


const pegIndexById = new Map(layout.pegs.map((peg) => [peg.id, peg.index] as const));
const selectedHitRate = (ids: readonly string[]): number => {
  const indices = ids.map((id) => {
    const index = pegIndexById.get(id);
    if (index === undefined) throw new Error(`Unknown selected special-pin id: ${id}`);
    return index;
  });

  let hitDrops = 0;
  for (const sample of samples) {
    const hits = new Set(sample.pegHitIndices ?? []);
    if (indices.some((index) => hits.has(index))) hitDrops += 1;
  }
  return hitDrops / RUNS;
};

const selectedLayout = {
  id: balance.plinko.specialPinLayout.id,
  amplifierByCount: Object.fromEntries(
    Object.entries(balance.plinko.specialPinLayout.amplifierByCount).map(
      ([count, ids]) => [
        count,
        {
          pegIds: ids,
          measuredBareHitRate: selectedHitRate(ids),
        },
      ],
    ),
  ),
  returnByLevel: balance.plinko.specialPinLayout.returnByLevel.map((entry) => ({
    level: entry.level,
    pegIds: entry.pegIds,
    targetFrequency: entry.targetFrequency,
    configuredMeasuredBareHitRate: entry.measuredBareHitRate,
    measuredBareHitRate: selectedHitRate(entry.pegIds),
    absoluteTargetDelta: Math.abs(selectedHitRate(entry.pegIds) - entry.targetFrequency),
  })),
  splitter: {
    pegIds: balance.plinko.specialPinLayout.splitterPegIds,
    measuredBareHitRate: selectedHitRate(
      balance.plinko.specialPinLayout.splitterPegIds,
    ),
  },
};

const report = {
  metadata: {
    runs: RUNS,
    seed: SEED,
    rows: balance.plinko.rows,
    geometry: balance.plinko.geometry,
    physics: balance.plinko.physicsSeed,
  },
  pegs: sortedPegs,
  symmetricPairs: sortedPairs,
  selectedLayout,
};

const percent = (value: number): string => `${(value * 100).toFixed(3)}%`;

const markdown = `# Plinko special-pin placement probe

This is placement evidence only. The run uses the accepted bare-board physics and records whether each physical peg was touched at least once during a Drop. No special-pin effect is active in this probe.

- runs: **${RUNS}**
- seed: **${SEED}**
- peg count: **${layout.pegs.length}**

## Selected BOARD_LAYOUT_V0 seed

- layout id: **${selectedLayout.id}**
- Amplifier 1-pin set: \`${selectedLayout.amplifierByCount['1'].pegIds.join(', ')}\` → **${percent(selectedLayout.amplifierByCount['1'].measuredBareHitRate)}**
- Amplifier 2-pin set: \`${selectedLayout.amplifierByCount['2'].pegIds.join(', ')}\` → **${percent(selectedLayout.amplifierByCount['2'].measuredBareHitRate)}**
- Amplifier 3-pin set: \`${selectedLayout.amplifierByCount['3'].pegIds.join(', ')}\` → **${percent(selectedLayout.amplifierByCount['3'].measuredBareHitRate)}**
- Splitter seed: \`${selectedLayout.splitter.pegIds.join(', ')}\` → **${percent(selectedLayout.splitter.measuredBareHitRate)}**

| Return level | Pegs | Target | Measured | Abs delta |
| ---: | --- | ---: | ---: | ---: |
${selectedLayout.returnByLevel.map((entry) => `| ${entry.level} | ${entry.pegIds.join(' + ')} | ${percent(entry.targetFrequency)} | ${percent(entry.measuredBareHitRate)} | ${percent(entry.absoluteTargetDelta)} |`).join('\n')}

## Individual peg hit rate

| Peg | Row | Column | Hit Drops | Hit Rate |
| --- | ---: | ---: | ---: | ---: |
${sortedPegs.map((peg) => `| ${peg.id} | ${peg.row} | ${peg.column} | ${peg.hitDrops} | ${percent(peg.hitRate)} |`).join('\n')}

## Symmetric slot hit rate

For a mirrored pair, a Drop counts once when it touches either member. A center peg appears as a self-pair.

| Slot | Row | Columns | Hit Drops | Hit Rate |
| --- | ---: | --- | ---: | ---: |
${sortedPairs.map((pair) => `| ${pair.id} | ${pair.row} | ${pair.leftColumn} / ${pair.rightColumn} | ${pair.hitDrops} | ${percent(pair.hitRate)} |`).join('\n')}
`;

const out = resolve(OUTPUT);
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'probe.json'), JSON.stringify(report, null, 2) + '\n');
writeFileSync(resolve(out, 'REPORT.md'), markdown);
writeFileSync(
  resolve(out, 'pegs.csv'),
  ['peg,row,column,x,y,hitDrops,hitRate', ...sortedPegs.map((peg) =>
    [peg.id, peg.row, peg.column, peg.x, peg.y, peg.hitDrops, peg.hitRate].join(',')
  )].join('\n') + '\n',
);
writeFileSync(
  resolve(out, 'pairs.csv'),
  ['slot,row,leftColumn,rightColumn,leftId,rightId,hitDrops,hitRate', ...sortedPairs.map((pair) =>
    [pair.id, pair.row, pair.leftColumn, pair.rightColumn, pair.leftId, pair.rightId, pair.hitDrops, pair.hitRate].join(',')
  )].join('\n') + '\n',
);

process.stdout.write(JSON.stringify({
  metadata: report.metadata,
  topPegs: sortedPegs.slice(0, 12),
  topPairs: sortedPairs.slice(0, 16),
  lowPairs: sortedPairs.slice(-12),
  selectedLayout,
}, null, 2) + '\n');
