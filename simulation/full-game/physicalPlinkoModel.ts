import { derivePocketMultipliers } from '../../src/core/plinko-rules/progression';
import { runCascadePhysicalDrops } from '../plinko/cascadeRunner';
import type { PlinkoOutcomeModel } from './runner';

/** Resolves one committed Drop using the canonical Matter cascade, including tails. */
export const createPhysicalPlinkoModel = (): PlinkoOutcomeModel => ({
  id: 'matter-cascade-direct-v1',
  resolve: ({ pendingDrop, config }) => {
    const sample = runCascadePhysicalDrops(config, {
      runs: 1, batchSize: 1, seed: pendingDrop.rngStateAtCommit, directSeed: true,
      stake: pendingDrop.originalStake,
      pocketMultipliers: derivePocketMultipliers(config, pendingDrop.pocketLevelsAtCommit),
      specialLevels: pendingDrop.specialLevelsAtCommit,
    })[0]!;
    if (sample.stuck) throw new Error(`Physical Drop ${pendingDrop.dropId} did not resolve`);
    return { aggregatePayout: sample.aggregatePayout, nextRngState: sample.nextRngState };
  },
});
