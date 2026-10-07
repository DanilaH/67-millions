import { getLaunchCapacity } from '../../src/core/plinko-rules/progression';
import type { BalanceConfig } from '../../src/config/balance.schema';
import type { GameState } from '../../src/core/state/GameState';
import type { BetFraction } from '../../src/core/plinko-rules/drop';
import type { FullGameDecision } from './runner';
import { createSharedWorld } from './sharedWorld';

type Observation = ReturnType<ReturnType<typeof createSharedWorld>['observe']>;

/** Diagnostic click policy, not a production autofire feature. */
export function runContinuousSession(
  initial: GameState,
  config: BalanceConfig,
  fraction: BetFraction,
  decide: (current: Observation) => FullGameDecision,
) {
  const world = createSharedWorld(initial, config);
  let ticks = 0, refillLaunches = 0, maxRoots = 0, maxBalls = 0;
  let stoppedAtTick: number | null = null;
  let stopReason = 'empty';
  try {
    if (!world.launch(fraction)) throw Error('Initial continuous launch refused');
    while (world.active) {
      if (ticks >= 72_000) throw Error('Continuous session exceeded diagnostic 20-minute limit');
      world.step(); ticks++;
      if (ticks % 15 !== 0 || stoppedAtTick !== null || !world.active) continue;
      const current = world.observe();
      maxRoots = Math.max(maxRoots, current.activeRoots);
      maxBalls = Math.max(maxBalls, current.liveBalls);
      const intention = decide(current);
      if (current.state.barryInterruptPending || current.state.terminalReason || intention.type !== 'PLINKO') {
        stoppedAtTick = ticks;
        stopReason = current.state.barryInterruptPending ? 'BARRY' : current.state.terminalReason ?? intention.type;
        continue;
      }
      // Capacity rejection is temporary. Paid roots keep resolving, so retry later.
      if (world.launch(intention.fraction ?? fraction) && current.launches >= getLaunchCapacity(config, current.state)) refillLaunches++;
    }
    const snapshot = world.snapshot();
    return { ...snapshot, seconds: ticks / 60, diagnostics: {
      launches:snapshot.launches, refillLaunches, sampledMaxRoots:maxRoots, sampledMaxBalls:maxBalls,
      stopReason, stoppedAtTick, drainSeconds:stoppedAtTick===null?0:(ticks-stoppedAtTick)/60,
    } };
  } finally { world.destroy(); }
}
