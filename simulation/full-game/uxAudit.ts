import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { parseBalanceConfig } from '../../src/config/balance';
import { derivePocketMultipliers } from '../../src/core/plinko-rules/progression';
import { runCascadePhysicalDrops } from '../plinko/cascadeRunner';
import { createLiquidityPolicy } from './liquidityPolicy';
import { runFullGame, type FullGameDecision } from './runner';

// Read-only diagnostic. Original policy/rules are unchanged; traces are observed before decisions.
const raw = readFileSync('balance.v0.json', 'utf8');
const config = parseBalanceConfig(JSON.parse(raw));
const configHash = createHash('sha256').update(raw).digest('hex');
const perPolicy = Number(process.argv[2] ?? 20);
const output = process.argv[3] ?? 'reports/pacing/2026-10-04';
const archetypes = ['CAUTIOUS', 'BASELINE_GROWTH', 'AGGRESSIVE', 'WORKER', 'DEGENERATE', 'RECKLESS_NEEDS'] as const;
const runs = [];
for (const archetype of archetypes) {
  for (let i = 0; i < perPolicy; i++) {
    const seed = 67104000 + i; // paired seeds; policies may consume RNG differently
    const policy = createLiquidityPolicy(config, archetype, seed);
    let physicsSeconds = 0;
    const trace: { type: string; cash: number; gameMinutes: number; drops: number; physicsSeconds: number }[] = [];
    const result = runFullGame(config, {
      id: policy.id,
      decide(context) {
        const decision: FullGameDecision = policy.decide(context);
        trace.push({ type: decision.type, cash: context.state.cash, gameMinutes: context.counters.gameMinutesAdvanced, drops: context.counters.plinkoDrops, physicsSeconds });
        return decision;
      },
    }, {
      id: 'matter-cascade-direct-v1+ux-ticks-v1',
      resolve({ pendingDrop }) {
        const sample = runCascadePhysicalDrops(config, {
          runs: 1, batchSize: 1, seed: pendingDrop.rngStateAtCommit, directSeed: true,
          stake: pendingDrop.originalStake,
          pocketMultipliers: derivePocketMultipliers(config, pendingDrop.pocketLevelsAtCommit),
          specialLevels: pendingDrop.specialLevelsAtCommit,
        })[0]!;
        if (sample.stuck) throw Error(`Stuck: ${archetype}/${seed}`);
        physicsSeconds += sample.ticks / config.plinko.geometry.fixedTimestepHz;
        return { aggregatePayout: sample.aggregatePayout, nextRngState: sample.nextRngState };
      },
    }, { seed, configHash, maxDecisions: 20000, maxGameMinutes: 35 * 1440 });
    runs.push({ archetype, result, physicsSeconds, trace });
    process.stderr.write(`${archetype} ${i + 1}/${perPolicy}: ${result.outcome}, ${result.counters.plinkoDrops} drops\n`);
  }
}
mkdirSync(output, { recursive: true });
writeFileSync(`${output}/runs.json.gz`, gzipSync(JSON.stringify({
  metadata: { configHash, codeRevision: execSync('git rev-parse HEAD').toString().trim(), perPolicy, seedStart: 67104000, model: 'matter-cascade-direct-v1+ux-ticks-v1', caveat: 'Sequential economic diagnostic. Does not model concurrent launches, player deliberation or passive real-time during skill games/cascades. Physics seconds are summed fixed ticks, not measured session duration.' }, runs,
}, null, 2)));
