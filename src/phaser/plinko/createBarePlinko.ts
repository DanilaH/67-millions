import Phaser from 'phaser';
import { BALL_LABEL, PEG_LABEL_PREFIX, POCKET_SENSOR_LABEL_PREFIX, dispatchPlinkoCollisions } from './collisionEvents';
import { snapshotSolver, restoreSolver } from './solverCheckpoint';
import type { PhysicsCheckpoint } from '../../core/plinko-rules/physicsCheckpoint';

import type { BalanceConfig } from '../../config/balance.schema';
import type {
  DropBallSnapshot,
  DropBallState,
} from '../../core/plinko-rules/drop';
import {
  deriveBarePlinkoLayout,
  getSpawnX,
  type PlinkoBoardLayout,
} from '../../core/plinko-rules/boardLayout';
import type { RandomSource } from '@danilah/mini-games-kit/core';
import { getReturnTarget } from '../../core/plinko-rules/returnPhysics';
import { deriveJackpotBiasGeometry } from '../../core/plinko-rules/jackpotBias';
import {
  getPlinkoWatchdogVelocity,
  isPlinkoBodyTechnicallyStuck,
} from '../../core/plinko-rules/stuckWatchdog';

const BALL_CATEGORY = 0x0002;
const STATIC_CATEGORY = 0x0001;

export interface BarePlinkoRuntime {
  layout: PlinkoBoardLayout;
  spawnBall(): MatterJS.BodyType;
  restoreBall(snapshot: DropBallSnapshot): MatterJS.BodyType;
  returnBall(body: MatterJS.BodyType): void;
  splitBall(body: MatterJS.BodyType): [MatterJS.BodyType, MatterJS.BodyType];
  setJackpotBiasLevel(level: number): void;
  removeBall(body: MatterJS.BodyType): void;
  snapshotBall(
    body: MatterJS.BodyType,
    metadata: DropBallState,
  ): DropBallSnapshot;
  getFixedTicksElapsed(): number;
  setFixedTicksElapsed(ticks: number): void;
  snapshotSolver(balls: ReadonlyMap<MatterJS.BodyType, DropBallState>): PhysicsCheckpoint;
  restoreSolver(snapshot: PhysicsCheckpoint, balls: ReadonlyMap<MatterJS.BodyType, DropBallState>): void;
  destroy(): void;
}

export interface BarePlinkoCallbacks {
  onPocket?: (index: number, body: MatterJS.BodyType) => void;
  onPeg?: (pegId: string, body: MatterJS.BodyType) => void;
  onFixedTick?: (fixedTicksElapsed: number) => void;
}

export const createBarePlinko = (
  scene: Phaser.Scene,
  config: BalanceConfig,
  random: RandomSource,
  callbacks: BarePlinkoCallbacks = {},
): BarePlinkoRuntime => {
  const matter = scene.matter;
  // The Matter plugin nulls its world before user SHUTDOWN listeners run.
  const world = matter.world;
  const layout = deriveBarePlinkoLayout(config);
  const geometry = config.plinko.geometry;
  const physics = config.plinko.physicsSeed;
  const createdBodies = new Set<MatterJS.BodyType>();
  const jackpotBiasBodies = new Set<MatterJS.BodyType>();
  const ballStationaryTicks = new Map<MatterJS.BodyType, number>();
  let fixedTicksElapsed = 0;

  matter.set60Hz();
  world.setGravity(0, physics.gravityY);

  const addCreated = (body: MatterJS.BodyType): MatterJS.BodyType => {
    createdBodies.add(body);
    return body;
  };

  for (const peg of layout.pegs) {
    addCreated(
      matter.add.circle(peg.x, peg.y, geometry.pegRadius, {
        isStatic: true,
        label: `${PEG_LABEL_PREFIX}${peg.id}`,
        restitution: physics.pegRestitution,
        friction: physics.friction,
        collisionFilter: {
          category: STATIC_CATEGORY,
          mask: 0xffff,
        },
      }),
    );
  }

  const wallThickness = geometry.pegRadius * 2;
  const wallCenterY = geometry.topPegY + geometry.boardAreaHeight / 2;
  const wallHeight = geometry.boardAreaHeight;

  addCreated(
    matter.add.rectangle(
      layout.leftWallX - wallThickness / 2,
      wallCenterY,
      wallThickness,
      wallHeight,
      {
        isStatic: true,
        label: 'plinko:left-wall',
        restitution: physics.wallRestitution,
        friction: physics.friction,
        collisionFilter: {
          category: STATIC_CATEGORY,
          mask: 0xffff,
        },
      },
    ),
  );
  addCreated(
    matter.add.rectangle(
      layout.rightWallX + wallThickness / 2,
      wallCenterY,
      wallThickness,
      wallHeight,
      {
        isStatic: true,
        label: 'plinko:right-wall',
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

  for (let index = 0; index < layout.pocketCenters.length - 1; index += 1) {
    const left = layout.pocketCenters[index]!;
    const right = layout.pocketCenters[index + 1]!;
    const x = (left.x + right.x) / 2;
    const y = layout.pocketTopY + dividerHeight / 2;

    addCreated(
      matter.add.rectangle(x, y, geometry.pegRadius * 1.5, dividerHeight, {
        isStatic: true,
        label: 'plinko:pocket-divider',
        restitution: physics.wallRestitution,
        friction: physics.friction,
        collisionFilter: {
          category: STATIC_CATEGORY,
          mask: 0xffff,
        },
      }),
    );
  }

  const sensorHeight = geometry.ballRadius * 2;
  for (let index = 0; index < layout.pocketCenters.length; index += 1) {
    const pocket = layout.pocketCenters[index]!;
    addCreated(
      matter.add.rectangle(
        pocket.x,
        layout.pocketBottomY,
        geometry.pocketCenterSpacing - geometry.pegRadius * 2,
        sensorHeight,
        {
          isStatic: true,
          isSensor: true,
          label: `${POCKET_SENSOR_LABEL_PREFIX}${index}`,
          collisionFilter: {
            category: STATIC_CATEGORY,
            mask: 0xffff,
          },
        },
      ),
    );
  }

  const handleCollision = (
    event: { pairs: { bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType }[] },
  ): void => {
    dispatchPlinkoCollisions(event.pairs, callbacks);
  };

  const handleAfterUpdate = (): void => {
    fixedTicksElapsed += 1;

    for (const [body, previousTicks] of ballStationaryTicks) {
      const nextTicks =
        body.velocity.x * body.velocity.x +
          body.velocity.y * body.velocity.y <=
        config.plinko.stuckWatchdog.speedEpsilon *
          config.plinko.stuckWatchdog.speedEpsilon
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
        matter.body.setVelocity(
          body,
          getPlinkoWatchdogVelocity(body.position.x, config),
        );
        ballStationaryTicks.set(body, 0);
      } else {
        ballStationaryTicks.set(body, nextTicks);
      }
    }

    callbacks.onFixedTick?.(fixedTicksElapsed);
  };

  const createBallAt = (
    x: number,
    y: number,
    stationaryTicks = 0,
  ): MatterJS.BodyType => {
    const body = addCreated(
      matter.add.circle(x, y, geometry.ballRadius, {
        label: BALL_LABEL,
        restitution: physics.ballRestitution,
        friction: physics.friction,
        frictionAir: physics.frictionAir,
        collisionFilter: {
          category: BALL_CATEGORY,
          mask: STATIC_CATEGORY,
        },
      }),
    );
    ballStationaryTicks.set(body, stationaryTicks);
    return body;
  };

  const setJackpotBiasLevel = (level: number): void => {
    for (const body of jackpotBiasBodies) {
      world.remove(body);
      createdBodies.delete(body);
    }
    jackpotBiasBodies.clear();

    for (const bumper of deriveJackpotBiasGeometry(config, level)) {
      const body = addCreated(
        matter.add.rectangle(
          bumper.x,
          bumper.y,
          bumper.length,
          bumper.thickness,
          {
            isStatic: true,
            angle: bumper.angleRadians,
            label: `plinko:${bumper.id}`,
            restitution: bumper.restitution,
            friction: physics.friction,
            collisionFilter: {
              category: STATIC_CATEGORY,
              mask: 0xffff,
            },
          },
        ),
      );
      jackpotBiasBodies.add(body);
    }
  };

  const removeBall = (body: MatterJS.BodyType): void => {
    world.remove(body);
    createdBodies.delete(body);
    ballStationaryTicks.delete(body);
  };

  world.on('collisionstart', handleCollision);
  world.on('afterupdate', handleAfterUpdate);

  return {
    layout,
    spawnBall: () =>
      createBallAt(
        getSpawnX(config, random.next()),
        geometry.topPegY - geometry.verticalPegSpacing,
      ),
    restoreBall: (snapshot) => {
      const body = createBallAt(
        snapshot.x,
        snapshot.y,
        snapshot.watchdogStationaryTicks,
      );
      matter.body.setVelocity(body, {
        x: snapshot.velocityX,
        y: snapshot.velocityY,
      });
      matter.body.setAngle(body, snapshot.angle);
      matter.body.setAngularVelocity(body, snapshot.angularVelocity);
      return body;
    },
    returnBall: (body) => {
      const target = getReturnTarget(config, body.position.x);
      matter.body.setPosition(body, target);
      matter.body.setVelocity(body, { x: 0, y: 0 });
      matter.body.setAngle(body, 0);
      matter.body.setAngularVelocity(body, 0);
      ballStationaryTicks.set(body, 0);
    },
    setJackpotBiasLevel,
    splitBall: (body) => {
      const { childHorizontalOffsetPx, childHorizontalVelocityDelta, childVerticalVelocityMultiplier } =
        config.plinko.splitterPhysics;
      const { x, y } = body.position;
      const { x: velocityX, y: velocityY } = body.velocity;

      removeBall(body);

      const left = createBallAt(x - childHorizontalOffsetPx, y);
      const right = createBallAt(x + childHorizontalOffsetPx, y);

      matter.body.setVelocity(left, {
        x: velocityX - childHorizontalVelocityDelta,
        y: velocityY * childVerticalVelocityMultiplier,
      });
      matter.body.setVelocity(right, {
        x: velocityX + childHorizontalVelocityDelta,
        y: velocityY * childVerticalVelocityMultiplier,
      });

      return [left, right];
    },
    removeBall,
    snapshotBall: (body, metadata) => ({
      ...metadata,
      amplifierProcIds: [...metadata.amplifierProcIds],
      x: body.position.x,
      y: body.position.y,
      velocityX: body.velocity.x,
      velocityY: body.velocity.y,
      angle: body.angle,
      angularVelocity: body.angularVelocity,
      watchdogStationaryTicks:
        ballStationaryTicks.get(body) ?? 0,
    }),
    getFixedTicksElapsed: () => fixedTicksElapsed,
    snapshotSolver: balls => snapshotSolver(world.engine, world.getAllBodies(), new Map([...balls].map(([body, state]) => [body, state.ballId]))),
    restoreSolver: (snapshot, balls) => restoreSolver(world.engine, world.getAllBodies(), new Map([...balls].map(([body, state]) => [body, state.ballId])), snapshot),
    setFixedTicksElapsed: (ticks) => {
      if (!Number.isInteger(ticks) || ticks < 0) {
        throw new RangeError(
          'fixedTicksElapsed must be a non-negative integer',
        );
      }
      fixedTicksElapsed = ticks;
    },
    destroy: () => {
      world.off('collisionstart', handleCollision);
      world.off('afterupdate', handleAfterUpdate);
      for (const body of createdBodies) {
        world.remove(body);
      }
      createdBodies.clear();
      jackpotBiasBodies.clear();
      ballStationaryTicks.clear();
    },
  };
};
