import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import type Phaser from 'phaser';
import type Matter from 'matter-js';
import { createBarePlinko } from '../../src/phaser/plinko/createBarePlinko';
import type { BalanceConfig } from '../../src/config/balance.schema';
import type { GameState } from '../../src/core/state/GameState';
import { SeededRandom } from '../../src/core/rng/SeededRandom';
import { commitBareDrop, calculateBallPocketPayout, settleAggregateDrop, type BetFraction, type PendingDrop, type DropBallState } from '../../src/core/plinko-rules/drop';
import { activeDrops, appendDrop, findBallDrop, recordDropPayout, removeSettledDrop } from '../../src/core/plinko-rules/concurrentDrops';
import { advancePendingDropTime, settleAggregatePendingDropAndResumeTime } from '../../src/core/plinko-rules/dropTiming';
import { advanceRunTime } from '../../src/core/time/runTime';
import { createRootBallState, deriveActiveSpecialPins, clearSplitterBlockAfterPeg, canAmplifyAt, markAmplifierProc, canReturnLineage, markReturnUsed, canSplitAt, createSplitChildren } from '../../src/core/plinko-rules/cascade';

// Use Phaser's pinned Matter fork, not the standalone simulation dependency.
const require = createRequire(import.meta.url);
const M = require(resolve(dirname(require.resolve('phaser')), '../src/physics/matter-js/CustomMain.js')) as typeof Matter;

export const createSharedWorld = (initial: GameState, config: BalanceConfig, checkpoint: PendingDrop | null = null) => {
  let state = structuredClone(initial);
  let pending: PendingDrop | null = null;
  let advancedMinutes = 0, launches = 0, elapsedTicks = 0;
  const settlements: { stake: number; payout: number; tick: number }[] = [];
  const diagnostics = { pockets: Array<number>(config.plinko.basePockets.length).fill(0), amplifierProcs: 0, returnProcs: 0, splitterProcs: 0 };
  const balls = new Map<MatterJS.BodyType, DropBallState>();
  const mutations: (() => void)[] = [];
  // MatterPhysics' constructor overrides the raw Matter defaults (Phaser 4.2.1,
  // src/physics/matter-js/MatterPhysics.js). Loading CustomMain alone skips it.
  // These are integration defaults, not a new physics/balance configuration.
  Object.assign(M.Resolver, {
    _restingThresh: 4, _restingThreshTangent: 6,
    _positionDampen: 0.9, _positionWarming: 0.8, _frictionNormalMultiplier: 5,
  });
  const engine = M.Engine.create();
  const listeners = new Map<(...args: never[]) => void, (event: Matter.IEvent<Matter.Engine>) => void>();
  const adapter = {
    matter: {
      set60Hz() {}, body: M.Body,
      add: {
        circle(x: number, y: number, r: number, options: Matter.IBodyDefinition) { const b = M.Bodies.circle(x, y, r, options); M.Composite.add(engine.world, b); return b; },
        rectangle(x: number, y: number, w: number, h: number, options: Matter.IChamferableBodyDefinition) { const b = M.Bodies.rectangle(x, y, w, h, options); M.Composite.add(engine.world, b); return b; },
      },
      world: {
        engine,
        setGravity(x: number, y: number) { engine.gravity.x = x; engine.gravity.y = y; },
        remove(body: Matter.Body) { M.Composite.remove(engine.world, body); },
        getAllBodies() { return M.Composite.allBodies(engine.world); },
        on(name: string, fn: (...args: never[]) => void) {
          const listener = fn as (event: Matter.IEvent<Matter.Engine>) => void;
          listeners.set(fn, listener); M.Events.on(engine, name === 'collisionstart' ? 'collisionStart' : 'afterUpdate', listener);
        },
        off(name: string, fn: (...args: never[]) => void) { M.Events.off(engine, name === 'collisionstart' ? 'collisionStart' : 'afterUpdate', listeners.get(fn)); },
      },
    },
  };
  const runtime = createBarePlinko(adapter as unknown as Phaser.Scene, config, {
    next() { const rng = new SeededRandom(state.rngState); const value = rng.next(); state = { ...state, rngState: rng.snapshot().state }; return value; },
  }, {
    onFixedTick(tick) {
      if (pending && tick % (60 * config.time.realSecondsPerGameMinute) === 0 && !state.barryInterruptPending && !state.terminalReason) {
        const next = advanceRunTime(state, null, 1, config); state = next.state; advancedMinutes += next.advancedMinutes;
      }
    },
    onPeg(id, body) { mutations.push(() => {
      if (!pending) return;
      let ball = balls.get(body); if (!ball) return;
      ball = clearSplitterBlockAfterPeg(ball, id); balls.set(body, ball);
      const active = deriveActiveSpecialPins(config, pending.specialLevelsAtCommit);
      if (active.amplifier?.pegIds.includes(id) && canAmplifyAt(ball, id)) {
        diagnostics.amplifierProcs++;
        for (const [b, meta] of balls) if (meta.lineageId === ball.lineageId) balls.set(b, markAmplifierProc(meta, id, active.amplifier.multiplier, b === body));
      } else if (active.return?.pegIds.includes(id) && canReturnLineage(ball)) {
        diagnostics.returnProcs++;
        for (const [b, meta] of balls) if (meta.lineageId === ball.lineageId) balls.set(b, markReturnUsed(meta));
        runtime.returnBall(body);
      } else if (active.splitter?.pegIds.includes(id) && canSplitAt(ball, id, balls.size, config)) {
        diagnostics.splitterProcs++;
        const children = createSplitChildren(ball, id, active.splitter.childValue);
        const bodies = runtime.splitBall(body); balls.delete(body);
        balls.set(bodies[0], children[0]); balls.set(bodies[1], children[1]);
      }
    }); },
    onPocket(index, body) { mutations.push(() => {
      const meta = balls.get(body); if (!pending || !meta) return;
      diagnostics.pockets[index]!++;
      const shot = findBallDrop(pending, meta.lineageId);
      const payout = (shot.physics?.alreadySettledPayout ?? 0) + calculateBallPocketPayout(shot, meta.currentValue, index, config);
      balls.delete(body); runtime.removeBall(body);
      pending = recordDropPayout(pending, shot.dropId, payout);
      if ([...balls.values()].some(b => b.lineageId === meta.lineageId)) return;
      pending = removeSettledDrop(pending, shot.dropId);
      if (pending) { const result = settleAggregateDrop(state, shot, payout, config); state = result.state; settlements.push({ stake: shot.originalStake, payout: result.payout, tick: elapsedTicks }); }
      else { const result = settleAggregatePendingDropAndResumeTime(state, shot, payout, config); state = result.state; advancedMinutes += result.remainingMinutesAdvancedAfterBarry; settlements.push({ stake: shot.originalStake, payout: result.payout, tick: elapsedTicks }); }
    }); },
  });
  if (checkpoint) {
    pending = structuredClone(checkpoint);
    if (!pending.physics?.solver) throw new Error('Shared-world restore requires a solver checkpoint');
    runtime.setJackpotBiasLevel(pending.specialLevelsAtCommit.jackpotBiasLevel);
    runtime.setFixedTicksElapsed(pending.physics.fixedTicksElapsed);
    for (const snapshot of pending.physics.balls) balls.set(runtime.restoreBall(snapshot), snapshot);
    runtime.restoreSolver(pending.physics.solver, balls);
  }
  return {
    launch(fraction: BetFraction): boolean {
      if (activeDrops(pending).length >= config.plinko.maxConcurrentDrops || balls.size >= config.plinko.maxActiveBalls || state.barryInterruptPending || state.terminalReason || state.cash <= 0) return false;
      const previous = pending;
      const committed = commitBareDrop(state, null, config, `audit:${launches}`, fraction);
      const timed = advancePendingDropTime(committed.state, committed.pendingDrop, config);
      state = timed.state; advancedMinutes += timed.advancedMinutes; pending = appendDrop(pending, timed.pendingDrop);
      if (!previous) { runtime.setJackpotBiasLevel(committed.pendingDrop.specialLevelsAtCommit.jackpotBiasLevel); runtime.setFixedTicksElapsed(0); }
      const body = runtime.spawnBall(); balls.set(body, createRootBallState(committed.pendingDrop.dropId)); launches++;
      return true;
    },
    step() { elapsedTicks++; M.Engine.update(engine, 1000 / 60); while (mutations.length) mutations.shift()!(); },
    snapshot() {
      const checkpoint = pending ? { ...pending, physics: { fixedTicksElapsed: runtime.getFixedTicksElapsed(), alreadySettledPayout: pending.physics?.alreadySettledPayout ?? 0, balls: [...balls].map(([b,m])=>runtime.snapshotBall(b,m)), solver: runtime.snapshotSolver(balls) } } : null;
      return { state: structuredClone(state), pending: structuredClone(checkpoint), advancedMinutes, launches, elapsedTicks, settlements: structuredClone(settlements), diagnostics: structuredClone(diagnostics) };
    },
    get active() { return pending !== null; },
    destroy() { runtime.destroy(); M.Engine.clear(engine); },
  };
};
