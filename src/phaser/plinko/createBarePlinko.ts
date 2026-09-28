import Phaser from 'phaser';

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

const BALL_CATEGORY = 0x0002;
const STATIC_CATEGORY = 0x0001;
const PEG_LABEL_PREFIX = 'plinko:peg:';
const BALL_LABEL = 'plinko:ball';
const POCKET_SENSOR_LABEL_PREFIX = 'plinko:pocket:';

export interface BarePlinkoRuntime {
  layout: PlinkoBoardLayout;
  spawnBall(): MatterJS.BodyType;
  restoreBall(snapshot: DropBallSnapshot): MatterJS.BodyType;
  returnBall(body: MatterJS.BodyType): void;
  splitBall(body: MatterJS.BodyType): [MatterJS.BodyType, MatterJS.BodyType];
  removeBall(body: MatterJS.BodyType): void;
  snapshotBall(
    body: MatterJS.BodyType,
    metadata: DropBallState,
  ): DropBallSnapshot;
  getFixedTicksElapsed(): number;
  setFixedTicksElapsed(ticks: number): void;
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
  const layout = deriveBarePlinkoLayout(config);
  const geometry = config.plinko.geometry;
  const physics = config.plinko.physicsSeed;
  const createdBodies = new Set<MatterJS.BodyType>();
  let fixedTicksElapsed = 0;

  matter.set60Hz();
  matter.world.setGravity(0, physics.gravityY);

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
    _event: unknown,
    bodyA: MatterJS.BodyType,
    bodyB: MatterJS.BodyType,
  ): void => {
    const ball =
      bodyA.label === BALL_LABEL
        ? bodyA
        : bodyB.label === BALL_LABEL
          ? bodyB
          : null;
    if (!ball) return;

    const other = bodyA === ball ? bodyB : bodyA;

    if (other.label.startsWith(POCKET_SENSOR_LABEL_PREFIX)) {
      const index = Number(
        other.label.slice(POCKET_SENSOR_LABEL_PREFIX.length),
      );
      if (Number.isInteger(index)) callbacks.onPocket?.(index, ball);
      return;
    }

    if (other.label.startsWith(PEG_LABEL_PREFIX)) {
      callbacks.onPeg?.(
        other.label.slice(PEG_LABEL_PREFIX.length),
        ball,
      );
    }
  };

  const handleAfterUpdate = (): void => {
    fixedTicksElapsed += 1;
    callbacks.onFixedTick?.(fixedTicksElapsed);
  };

  const createBallAt = (x: number, y: number): MatterJS.BodyType =>
    addCreated(
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

  const removeBall = (body: MatterJS.BodyType): void => {
    matter.world.remove(body);
    createdBodies.delete(body);
  };

  matter.world.on('collisionstart', handleCollision);
  matter.world.on('afterupdate', handleAfterUpdate);

  return {
    layout,
    spawnBall: () =>
      createBallAt(
        getSpawnX(config, random.next()),
        geometry.topPegY - geometry.verticalPegSpacing,
      ),
    restoreBall: (snapshot) => {
      const body = createBallAt(snapshot.x, snapshot.y);
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
    },
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
    }),
    getFixedTicksElapsed: () => fixedTicksElapsed,
    setFixedTicksElapsed: (ticks) => {
      if (!Number.isInteger(ticks) || ticks < 0) {
        throw new RangeError(
          'fixedTicksElapsed must be a non-negative integer',
        );
      }
      fixedTicksElapsed = ticks;
    },
    destroy: () => {
      matter.world.off('collisionstart', handleCollision);
      matter.world.off('afterupdate', handleAfterUpdate);
      for (const body of createdBodies) {
        matter.world.remove(body);
      }
      createdBodies.clear();
    },
  };
};
