import Phaser from 'phaser';

import type { BalanceConfig } from '../../config/balance.schema';
import type { DropBallSnapshot } from '../../core/plinko-rules/drop';
import {
  deriveBarePlinkoLayout,
  getSpawnX,
  type PlinkoBoardLayout,
} from '../../core/plinko-rules/boardLayout';
import type { RandomSource } from '@danilah/mini-games-kit/core';

const PEG_LABEL = 'plinko:peg';
const BALL_LABEL = 'plinko:ball';
const POCKET_SENSOR_LABEL_PREFIX = 'plinko:pocket:';

export interface BallSnapshotMetadata {
  ballId: string;
  currentValue: number;
  lineageId: string;
  splitDepth: number;
  amplifierProcIds: string[];
  returnUsed: boolean;
  blockedSplitterId: string | null;
}

export interface BarePlinkoRuntime {
  layout: PlinkoBoardLayout;
  spawnBall(): MatterJS.BodyType;
  restoreBall(snapshot: DropBallSnapshot): MatterJS.BodyType;
  snapshotBall(
    body: MatterJS.BodyType,
    metadata: BallSnapshotMetadata,
  ): DropBallSnapshot;
  getFixedTicksElapsed(): number;
  setFixedTicksElapsed(ticks: number): void;
  destroy(): void;
}

export interface BarePlinkoCallbacks {
  onPocket?: (index: number, body: MatterJS.BodyType) => void;
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
  const createdBodies: MatterJS.BodyType[] = [];
  let fixedTicksElapsed = 0;

  matter.set60Hz();
  matter.world.setGravity(0, physics.gravityY);

  for (const peg of layout.pegs) {
    createdBodies.push(
      matter.add.circle(peg.x, peg.y, geometry.pegRadius, {
        isStatic: true,
        label: PEG_LABEL,
        restitution: physics.pegRestitution,
        friction: physics.friction,
      }),
    );
  }

  const wallThickness = geometry.pegRadius * 2;
  const wallCenterY = geometry.topPegY + geometry.boardAreaHeight / 2;
  const wallHeight = geometry.boardAreaHeight;

  createdBodies.push(
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
      },
    ),
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

    createdBodies.push(
      matter.add.rectangle(x, y, geometry.pegRadius * 1.5, dividerHeight, {
        isStatic: true,
        label: 'plinko:pocket-divider',
        restitution: physics.wallRestitution,
        friction: physics.friction,
      }),
    );
  }

  const sensorHeight = geometry.ballRadius * 2;
  for (let index = 0; index < layout.pocketCenters.length; index += 1) {
    const pocket = layout.pocketCenters[index]!;
    createdBodies.push(
      matter.add.rectangle(
        pocket.x,
        layout.pocketBottomY,
        geometry.pocketCenterSpacing - geometry.pegRadius * 2,
        sensorHeight,
        {
          isStatic: true,
          isSensor: true,
          label: `${POCKET_SENSOR_LABEL_PREFIX}${index}`,
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

    const sensor = bodyA === ball ? bodyB : bodyA;
    if (!sensor.label.startsWith(POCKET_SENSOR_LABEL_PREFIX)) return;

    const index = Number(sensor.label.slice(POCKET_SENSOR_LABEL_PREFIX.length));
    if (Number.isInteger(index)) callbacks.onPocket?.(index, ball);
  };

  const handleAfterUpdate = (): void => {
    fixedTicksElapsed += 1;
    callbacks.onFixedTick?.(fixedTicksElapsed);
  };

  const createBallAt = (x: number, y: number): MatterJS.BodyType => {
    const body = matter.add.circle(x, y, geometry.ballRadius, {
      label: BALL_LABEL,
      restitution: physics.ballRestitution,
      friction: physics.friction,
      frictionAir: physics.frictionAir,
    });
    createdBodies.push(body);
    return body;
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
        throw new RangeError('fixedTicksElapsed must be a non-negative integer');
      }
      fixedTicksElapsed = ticks;
    },
    destroy: () => {
      matter.world.off('collisionstart', handleCollision);
      matter.world.off('afterupdate', handleAfterUpdate);
      for (const body of createdBodies) {
        matter.world.remove(body);
      }
    },
  };
};
