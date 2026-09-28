import Matter from 'matter-js';

import type { BalanceConfig } from '../../src/config/balance.schema';
import {
  canAmplifyAt,
  canReturnLineage,
  canSplitAt,
  clearSplitterBlockAfterPeg,
  createRootBallState,
  createSplitChildren,
  deriveActiveSpecialPins,
  markAmplifierProc,
  markReturnUsed,
} from '../../src/core/plinko-rules/cascade';
import type { DropBallState } from '../../src/core/plinko-rules/drop';
import {
  deriveBarePlinkoLayout,
  getSpawnX,
} from '../../src/core/plinko-rules/boardLayout';
import type { SpecialUpgradeLevels } from '../../src/core/plinko-rules/progression';
import { SeededRandom } from '../../src/core/rng/SeededRandom';
import { getReturnTarget } from '../../src/core/plinko-rules/returnPhysics';
import { deriveJackpotBiasGeometry } from '../../src/core/plinko-rules/jackpotBias';
import {
  getPlinkoWatchdogVelocity,
  isPlinkoBodyTechnicallyStuck,
} from '../../src/core/plinko-rules/stuckWatchdog';

const STATIC_CATEGORY = 0x0001;
const BALL_CATEGORY = 0x0002;
const BALL_LABEL = 'cascade:ball';

export interface CascadeRunnerOptions {
  runs: number;
  seed: number;
  pocketMultipliers: readonly number[];
  specialLevels: SpecialUpgradeLevels;
  stake?: number;
  batchSize?: number;
  maxTicks?: number;
}

export interface CascadeStuckBallDiagnostic {
  ballId: string;
  lineageId: string;
  splitDepth: number;
  currentValue: number;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
}

export interface CascadeDropSample {
  aggregatePayout: number;
  aggregateMultiplier: number;
  terminalBallCount: number;
  childBallCount: number;
  returnCount: number;
  amplifierProcCount: number;
  maxActiveBalls: number;
  ticks: number;
  stuck: boolean;
  stuckBalls: CascadeStuckBallDiagnostic[];
  pocketCounts: number[];
}

interface BallMeta {
  dropIndex: number;
  state: DropBallState;
}

interface DropMeta {
  random: SeededRandom;
  payout: number;
  terminalBallCount: number;
  childBallCount: number;
  returnCount: number;
  amplifierProcCount: number;
  maxActiveBalls: number;
  pocketCounts: number[];
  completedTick: number | null;
}

interface StaticBoard {
  bodies: Matter.Body[];
  pegIdByBodyId: Map<number, string>;
  pocketIndexByBodyId: Map<number, number>;
}

const seedForDrop = (baseSeed: number, dropIndex: number): number => {
  const mixed =
    (baseSeed + Math.imul(dropIndex + 1, 0x9e3779b9)) >>> 0;
  return mixed === 0 ? 0x6d2b79f5 : mixed;
};

const createStaticBoard = (
  config: BalanceConfig,
  jackpotBiasLevel: number,
): StaticBoard => {
  const layout = deriveBarePlinkoLayout(config);
  const geometry = config.plinko.geometry;
  const physics = config.plinko.physicsSeed;
  const bodies: Matter.Body[] = [];
  const pegIdByBodyId = new Map<number, string>();
  const pocketIndexByBodyId = new Map<number, number>();

  for (const peg of layout.pegs) {
    const body = Matter.Bodies.circle(
      peg.x,
      peg.y,
      geometry.pegRadius,
      {
        isStatic: true,
        label: `cascade:peg:${peg.id}`,
        restitution: physics.pegRestitution,
        friction: physics.friction,
        collisionFilter: {
          category: STATIC_CATEGORY,
          mask: 0xffff,
        },
      },
    );
    bodies.push(body);
    pegIdByBodyId.set(body.id, peg.id);
  }

  for (const bumper of deriveJackpotBiasGeometry(config, jackpotBiasLevel)) {
    bodies.push(
      Matter.Bodies.circle(
        bumper.x,
        bumper.y,
        bumper.radius,
        {
          isStatic: true,
          label: `cascade:${bumper.id}`,
          restitution: bumper.restitution,
          friction: physics.friction,
          collisionFilter: {
            category: STATIC_CATEGORY,
            mask: 0xffff,
          },
        },
      ),
    );
  }

  const wallThickness = geometry.pegRadius * 2;
  const wallCenterY =
    geometry.topPegY + geometry.boardAreaHeight / 2;
  const wallHeight = geometry.boardAreaHeight;

  bodies.push(
    Matter.Bodies.rectangle(
      layout.leftWallX - wallThickness / 2,
      wallCenterY,
      wallThickness,
      wallHeight,
      {
        isStatic: true,
        label: 'cascade:left-wall',
        restitution: physics.wallRestitution,
        friction: physics.friction,
        collisionFilter: {
          category: STATIC_CATEGORY,
          mask: 0xffff,
        },
      },
    ),
    Matter.Bodies.rectangle(
      layout.rightWallX + wallThickness / 2,
      wallCenterY,
      wallThickness,
      wallHeight,
      {
        isStatic: true,
        label: 'cascade:right-wall',
        restitution: physics.wallRestitution,
        friction: physics.friction,
        collisionFilter: {
          category: STATIC_CATEGORY,
          mask: 0xffff,
        },
      },
    ),
  );

  const dividerHeight = Math.max(
    geometry.verticalPegSpacing,
    layout.pocketBottomY - layout.pocketTopY,
  );

  for (
    let index = 0;
    index < layout.pocketCenters.length - 1;
    index += 1
  ) {
    const left = layout.pocketCenters[index]!;
    const right = layout.pocketCenters[index + 1]!;
    bodies.push(
      Matter.Bodies.rectangle(
        (left.x + right.x) / 2,
        layout.pocketTopY + dividerHeight / 2,
        geometry.pegRadius * 1.5,
        dividerHeight,
        {
          isStatic: true,
          label: 'cascade:pocket-divider',
          restitution: physics.wallRestitution,
          friction: physics.friction,
          collisionFilter: {
            category: STATIC_CATEGORY,
            mask: 0xffff,
          },
        },
      ),
    );
  }

  const sensorHeight = geometry.ballRadius * 2;
  for (
    let index = 0;
    index < layout.pocketCenters.length;
    index += 1
  ) {
    const pocket = layout.pocketCenters[index]!;
    const body = Matter.Bodies.rectangle(
      pocket.x,
      layout.pocketBottomY,
      geometry.pocketCenterSpacing - geometry.pegRadius * 2,
      sensorHeight,
      {
        isStatic: true,
        isSensor: true,
        label: `cascade:pocket:${index}`,
        collisionFilter: {
          category: STATIC_CATEGORY,
          mask: 0xffff,
        },
      },
    );
    bodies.push(body);
    pocketIndexByBodyId.set(body.id, index);
  }

  return {
    bodies,
    pegIdByBodyId,
    pocketIndexByBodyId,
  };
};

const createBall = (
  config: BalanceConfig,
  x: number,
  y: number,
): Matter.Body =>
  Matter.Bodies.circle(
    x,
    y,
    config.plinko.geometry.ballRadius,
    {
      label: BALL_LABEL,
      restitution: config.plinko.physicsSeed.ballRestitution,
      friction: config.plinko.physicsSeed.friction,
      frictionAir: config.plinko.physicsSeed.frictionAir,
      collisionFilter: {
        category: BALL_CATEGORY,
        mask: STATIC_CATEGORY,
      },
    },
  );

const countActiveForDrop = (
  bodyMeta: ReadonlyMap<number, BallMeta>,
  dropIndex: number,
): number => {
  let count = 0;
  for (const meta of bodyMeta.values()) {
    if (meta.dropIndex === dropIndex) count += 1;
  }
  return count;
};

const updateLineage = (
  bodyMeta: Map<number, BallMeta>,
  dropIndex: number,
  lineageId: string,
  update: (bodyId: number, state: DropBallState) => DropBallState,
): void => {
  for (const [bodyId, meta] of bodyMeta) {
    if (
      meta.dropIndex === dropIndex &&
      meta.state.lineageId === lineageId
    ) {
      bodyMeta.set(bodyId, {
        ...meta,
        state: update(bodyId, meta.state),
      });
    }
  }
};

export const runCascadePhysicalDrops = (
  config: BalanceConfig,
  options: CascadeRunnerOptions,
): CascadeDropSample[] => {
  if (!Number.isInteger(options.runs) || options.runs <= 0) {
    throw new RangeError('runs must be a positive integer');
  }
  if (
    options.pocketMultipliers.length !==
    config.plinko.basePockets.length
  ) {
    throw new RangeError(
      'pocketMultipliers must contain one value per pocket',
    );
  }

  const stake = options.stake ?? 100_000;
  const batchSize = options.batchSize ?? 64;
  const maxTicks =
    options.maxTicks ??
    config.plinko.geometry.fixedTimestepHz * 60;

  if (!Number.isInteger(stake) || stake <= 0) {
    throw new RangeError('stake must be a positive integer');
  }
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new RangeError('batchSize must be a positive integer');
  }
  if (!Number.isInteger(maxTicks) || maxTicks <= 0) {
    throw new RangeError('maxTicks must be a positive integer');
  }

  const engine = Matter.Engine.create();
  engine.gravity.x = 0;
  engine.gravity.y = config.plinko.physicsSeed.gravityY;

  const board = createStaticBoard(
    config,
    options.specialLevels.jackpotBiasLevel,
  );
  Matter.Composite.add(engine.world, board.bodies);

  const activeSpecial = deriveActiveSpecialPins(
    config,
    options.specialLevels,
  );
  const amplifierIds = new Set(
    activeSpecial.amplifier?.pegIds ?? [],
  );
  const returnIds = new Set(
    activeSpecial.return?.pegIds ?? [],
  );
  const splitterIds = new Set(
    activeSpecial.splitter?.pegIds ?? [],
  );

  const samples: CascadeDropSample[] = new Array(options.runs);
  const timestepMs =
    1000 / config.plinko.geometry.fixedTimestepHz;
  const layout = deriveBarePlinkoLayout(config);

  for (
    let batchStart = 0;
    batchStart < options.runs;
    batchStart += batchSize
  ) {
    const batchEnd = Math.min(
      options.runs,
      batchStart + batchSize,
    );
    const bodyMeta = new Map<number, BallMeta>();
    const bodies = new Map<number, Matter.Body>();
    const stationaryTicks = new Map<number, number>();
    const drops = new Map<number, DropMeta>();

    const addBall = (
      dropIndex: number,
      state: DropBallState,
      body: Matter.Body,
    ): void => {
      bodyMeta.set(body.id, { dropIndex, state });
      bodies.set(body.id, body);
      stationaryTicks.set(body.id, 0);
      Matter.Composite.add(engine.world, body);

      const drop = drops.get(dropIndex)!;
      drop.maxActiveBalls = Math.max(
        drop.maxActiveBalls,
        countActiveForDrop(bodyMeta, dropIndex),
      );
    };

    const removeBall = (bodyId: number): void => {
      const body = bodies.get(bodyId);
      if (body) {
        Matter.Composite.remove(engine.world, body);
      }
      bodies.delete(bodyId);
      bodyMeta.delete(bodyId);
      stationaryTicks.delete(bodyId);
    };

    for (
      let dropIndex = batchStart;
      dropIndex < batchEnd;
      dropIndex += 1
    ) {
      const random = new SeededRandom(
        seedForDrop(options.seed, dropIndex),
      );
      drops.set(dropIndex, {
        random,
        payout: 0,
        terminalBallCount: 0,
        childBallCount: 0,
        returnCount: 0,
        amplifierProcCount: 0,
        maxActiveBalls: 1,
        pocketCounts: Array.from(
          { length: options.pocketMultipliers.length },
          () => 0,
        ),
        completedTick: null,
      });

      const root = createRootBallState(`sim:${dropIndex}`);
      const body = createBall(
        config,
        getSpawnX(config, random.next()),
        config.plinko.geometry.topPegY -
          config.plinko.geometry.verticalPegSpacing,
      );
      addBall(dropIndex, root, body);
    }

    type PegEvent = { bodyId: number; pegId: string };
    type PocketEvent = { bodyId: number; pocketIndex: number };

    let pegEvents: PegEvent[] = [];
    let pocketEvents: PocketEvent[] = [];

    const onCollision = (
      event: Matter.IEventCollision<Matter.Engine>,
    ): void => {
      for (const pair of event.pairs) {
        const candidates: Array<[Matter.Body, Matter.Body]> = [
          [pair.bodyA, pair.bodyB],
          [pair.bodyB, pair.bodyA],
        ];

        for (const [ball, other] of candidates) {
          if (ball.label !== BALL_LABEL) continue;
          if (!bodyMeta.has(ball.id)) continue;

          const pocketIndex =
            board.pocketIndexByBodyId.get(other.id);
          if (pocketIndex !== undefined) {
            pocketEvents.push({
              bodyId: ball.id,
              pocketIndex,
            });
            continue;
          }

          const pegId = board.pegIdByBodyId.get(other.id);
          if (pegId !== undefined) {
            pegEvents.push({
              bodyId: ball.id,
              pegId,
            });
          }
        }
      }
    };

    Matter.Events.on(engine, 'collisionStart', onCollision);

    for (
      let tick = 1;
      tick <= maxTicks && bodyMeta.size > 0;
      tick += 1
    ) {
      pegEvents = [];
      pocketEvents = [];
      Matter.Engine.update(engine, timestepMs);

      for (const event of pegEvents) {
        const meta = bodyMeta.get(event.bodyId);
        const body = bodies.get(event.bodyId);
        if (!meta || !body) continue;

        const drop = drops.get(meta.dropIndex)!;
        let state = clearSplitterBlockAfterPeg(
          meta.state,
          event.pegId,
        );
        bodyMeta.set(event.bodyId, {
          ...meta,
          state,
        });

        if (
          activeSpecial.amplifier &&
          amplifierIds.has(event.pegId) &&
          canAmplifyAt(state, event.pegId)
        ) {
          const lineageId = state.lineageId;
          updateLineage(
            bodyMeta,
            meta.dropIndex,
            lineageId,
            (bodyId, candidate) =>
              markAmplifierProc(
                candidate,
                event.pegId,
                activeSpecial.amplifier!.multiplier,
                bodyId === event.bodyId,
              ),
          );
          drop.amplifierProcCount += 1;
          continue;
        }

        state = bodyMeta.get(event.bodyId)!.state;

        if (
          returnIds.has(event.pegId) &&
          canReturnLineage(state)
        ) {
          const lineageId = state.lineageId;
          updateLineage(
            bodyMeta,
            meta.dropIndex,
            lineageId,
            (_bodyId, candidate) =>
              markReturnUsed(candidate),
          );

          Matter.Body.setPosition(
            body,
            getReturnTarget(config, body.position.x),
          );
          Matter.Body.setVelocity(body, { x: 0, y: 0 });
          Matter.Body.setAngle(body, 0);
          Matter.Body.setAngularVelocity(body, 0);
          stationaryTicks.set(body.id, 0);
          drop.returnCount += 1;
          continue;
        }

        state = bodyMeta.get(event.bodyId)!.state;

        if (
          activeSpecial.splitter &&
          splitterIds.has(event.pegId)
        ) {
          const activeCount = countActiveForDrop(
            bodyMeta,
            meta.dropIndex,
          );

          if (
            canSplitAt(
              state,
              event.pegId,
              activeCount,
              config,
            )
          ) {
            const [leftState, rightState] =
              createSplitChildren(
                state,
                event.pegId,
                activeSpecial.splitter.childValue,
              );
            const { x, y } = body.position;
            const velocity = { ...body.velocity };
            const split = config.plinko.splitterPhysics;

            removeBall(event.bodyId);

            const left = createBall(
              config,
              x - split.childHorizontalOffsetPx,
              y,
            );
            const right = createBall(
              config,
              x + split.childHorizontalOffsetPx,
              y,
            );

            Matter.Body.setVelocity(left, {
              x:
                velocity.x -
                split.childHorizontalVelocityDelta,
              y:
                velocity.y *
                split.childVerticalVelocityMultiplier,
            });
            Matter.Body.setVelocity(right, {
              x:
                velocity.x +
                split.childHorizontalVelocityDelta,
              y:
                velocity.y *
                split.childVerticalVelocityMultiplier,
            });

            addBall(meta.dropIndex, leftState, left);
            addBall(meta.dropIndex, rightState, right);
            drop.childBallCount += 2;
          }
        }
      }

      const handledPocketBodies = new Set<number>();

      for (const event of pocketEvents) {
        if (handledPocketBodies.has(event.bodyId)) continue;

        const meta = bodyMeta.get(event.bodyId);
        if (!meta) continue;

        handledPocketBodies.add(event.bodyId);
        const drop = drops.get(meta.dropIndex)!;
        const pocketMultiplier =
          options.pocketMultipliers[event.pocketIndex];

        if (pocketMultiplier === undefined) {
          throw new RangeError('Invalid pocket index');
        }

        drop.payout += Math.round(
          stake *
            meta.state.currentValue *
            pocketMultiplier,
        );
        drop.terminalBallCount += 1;
        drop.pocketCounts[event.pocketIndex] =
          (drop.pocketCounts[event.pocketIndex] ?? 0) + 1;

        removeBall(event.bodyId);

        if (
          countActiveForDrop(bodyMeta, meta.dropIndex) === 0 &&
          drop.completedTick === null
        ) {
          drop.completedTick = tick;
        }
      }

      for (const [bodyId, body] of bodies) {
        const previousTicks = stationaryTicks.get(bodyId) ?? 0;
        const speedSquared =
          body.velocity.x * body.velocity.x +
          body.velocity.y * body.velocity.y;
        const epsilon = config.plinko.stuckWatchdog.speedEpsilon;
        const nextTicks =
          speedSquared <= epsilon * epsilon
            ? previousTicks + 1
            : 0;

        if (
          isPlinkoBodyTechnicallyStuck(
            body.velocity.x,
            body.velocity.y,
            nextTicks,
            config,
          )
        ) {
          Matter.Body.setVelocity(
            body,
            getPlinkoWatchdogVelocity(body.position.x, config),
          );
          stationaryTicks.set(bodyId, 0);
        } else {
          stationaryTicks.set(bodyId, nextTicks);
        }
      }
    }

    Matter.Events.off(engine, 'collisionStart', onCollision);

    for (
      let dropIndex = batchStart;
      dropIndex < batchEnd;
      dropIndex += 1
    ) {
      const drop = drops.get(dropIndex)!;
      const remaining = countActiveForDrop(
        bodyMeta,
        dropIndex,
      );
      const stuck = remaining > 0;

      const stuckBalls = stuck
        ? Array.from(bodyMeta.entries())
            .filter(([, meta]) => meta.dropIndex === dropIndex)
            .map(([bodyId, meta]) => {
              const body = bodies.get(bodyId)!;
              return {
                ballId: meta.state.ballId,
                lineageId: meta.state.lineageId,
                splitDepth: meta.state.splitDepth,
                currentValue: meta.state.currentValue,
                x: body.position.x,
                y: body.position.y,
                velocityX: body.velocity.x,
                velocityY: body.velocity.y,
              };
            })
        : [];

      samples[dropIndex] = {
        aggregatePayout: drop.payout,
        aggregateMultiplier: drop.payout / stake,
        terminalBallCount: drop.terminalBallCount,
        childBallCount: drop.childBallCount,
        returnCount: drop.returnCount,
        amplifierProcCount: drop.amplifierProcCount,
        maxActiveBalls: drop.maxActiveBalls,
        ticks: drop.completedTick ?? maxTicks,
        stuck,
        stuckBalls,
        pocketCounts: drop.pocketCounts,
      };
    }

    for (const body of bodies.values()) {
      Matter.Composite.remove(engine.world, body);
    }
  }

  Matter.Engine.clear(engine);
  return samples;
};
