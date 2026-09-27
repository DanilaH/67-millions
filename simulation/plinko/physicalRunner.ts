import * as Matter from 'matter-js';

import type { BalanceConfig } from '../../src/config/balance.schema';
import { deriveBarePlinkoLayout, getSpawnX } from '../../src/core/plinko-rules/boardLayout';
import { SeededRandom } from '../../src/core/rng/SeededRandom';

const STATIC_CATEGORY = 0x0001;
const BALL_CATEGORY = 0x0002;
const BALL_LABEL = 'sim:ball';
const SENSOR_PREFIX = 'sim:pocket:';

export interface PhysicalDropSample {
  pocketIndex: number | null;
  multiplier: number;
  collisions: number;
  ticks: number;
  stuck: boolean;
}

export interface PhysicalRunnerOptions {
  runs: number;
  seed: number;
  batchSize?: number;
  maxTicks?: number;
}

interface ActiveBallMeta {
  dropIndex: number;
  collisions: number;
  ticks: number;
  settledPocket: number | null;
}

const createStaticBoard = (
  config: BalanceConfig,
): { bodies: Matter.Body[]; sensorPocketByBodyId: Map<number, number> } => {
  const layout = deriveBarePlinkoLayout(config);
  const geometry = config.plinko.geometry;
  const physics = config.plinko.physicsSeed;
  const bodies: Matter.Body[] = [];
  const sensorPocketByBodyId = new Map<number, number>();

  for (const peg of layout.pegs) {
    bodies.push(
      Matter.Bodies.circle(peg.x, peg.y, geometry.pegRadius, {
        isStatic: true,
        label: 'sim:peg',
        restitution: physics.pegRestitution,
        friction: physics.friction,
        collisionFilter: { category: STATIC_CATEGORY, mask: 0xffff },
      }),
    );
  }

  const wallThickness = geometry.pegRadius * 2;
  const wallCenterY = geometry.topPegY + geometry.boardAreaHeight / 2;
  const wallHeight = geometry.boardAreaHeight;

  bodies.push(
    Matter.Bodies.rectangle(
      layout.leftWallX - wallThickness / 2,
      wallCenterY,
      wallThickness,
      wallHeight,
      {
        isStatic: true,
        label: 'sim:left-wall',
        restitution: physics.wallRestitution,
        friction: physics.friction,
        collisionFilter: { category: STATIC_CATEGORY, mask: 0xffff },
      },
    ),
    Matter.Bodies.rectangle(
      layout.rightWallX + wallThickness / 2,
      wallCenterY,
      wallThickness,
      wallHeight,
      {
        isStatic: true,
        label: 'sim:right-wall',
        restitution: physics.wallRestitution,
        friction: physics.friction,
        collisionFilter: { category: STATIC_CATEGORY, mask: 0xffff },
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
    bodies.push(
      Matter.Bodies.rectangle(
        (left.x + right.x) / 2,
        layout.pocketTopY + dividerHeight / 2,
        geometry.pegRadius * 1.5,
        dividerHeight,
        {
          isStatic: true,
          label: 'sim:pocket-divider',
          restitution: physics.wallRestitution,
          friction: physics.friction,
          collisionFilter: { category: STATIC_CATEGORY, mask: 0xffff },
        },
      ),
    );
  }

  const sensorHeight = geometry.ballRadius * 2;
  for (let index = 0; index < layout.pocketCenters.length; index += 1) {
    const pocket = layout.pocketCenters[index]!;
    const sensor = Matter.Bodies.rectangle(
      pocket.x,
      layout.pocketBottomY,
      geometry.pocketCenterSpacing - geometry.pegRadius * 2,
      sensorHeight,
      {
        isStatic: true,
        isSensor: true,
        label: `${SENSOR_PREFIX}${index}`,
        collisionFilter: { category: STATIC_CATEGORY, mask: 0xffff },
      },
    );
    bodies.push(sensor);
    sensorPocketByBodyId.set(sensor.id, index);
  }

  return { bodies, sensorPocketByBodyId };
};

const createBall = (
  config: BalanceConfig,
  random: SeededRandom,
): Matter.Body => {
  const geometry = config.plinko.geometry;
  const physics = config.plinko.physicsSeed;

  return Matter.Bodies.circle(
    getSpawnX(config, random.next()),
    geometry.topPegY - geometry.verticalPegSpacing,
    geometry.ballRadius,
    {
      label: BALL_LABEL,
      restitution: physics.ballRestitution,
      friction: physics.friction,
      frictionAir: physics.frictionAir,
      collisionFilter: {
        category: BALL_CATEGORY,
        mask: STATIC_CATEGORY,
      },
    },
  );
};

export const runBarePhysicalDrops = (
  config: BalanceConfig,
  options: PhysicalRunnerOptions,
): PhysicalDropSample[] => {
  if (!Number.isInteger(options.runs) || options.runs <= 0) {
    throw new RangeError('runs must be a positive integer');
  }

  const batchSize = options.batchSize ?? 256;
  const maxTicks = options.maxTicks ?? config.plinko.geometry.fixedTimestepHz * 20;
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new RangeError('batchSize must be a positive integer');
  }
  if (!Number.isInteger(maxTicks) || maxTicks <= 0) {
    throw new RangeError('maxTicks must be a positive integer');
  }

  const engine = Matter.Engine.create();
  engine.gravity.x = 0;
  engine.gravity.y = config.plinko.physicsSeed.gravityY;

  const { bodies: boardBodies, sensorPocketByBodyId } = createStaticBoard(config);
  Matter.Composite.add(engine.world, boardBodies);

  const random = new SeededRandom(options.seed);
  const samples: PhysicalDropSample[] = new Array(options.runs);
  const timestepMs = 1000 / config.plinko.geometry.fixedTimestepHz;

  for (let batchStart = 0; batchStart < options.runs; batchStart += batchSize) {
    const batchEnd = Math.min(options.runs, batchStart + batchSize);
    const bodyMeta = new Map<number, ActiveBallMeta>();
    const activeBodies = new Set<Matter.Body>();

    for (let dropIndex = batchStart; dropIndex < batchEnd; dropIndex += 1) {
      const body = createBall(config, random);
      bodyMeta.set(body.id, {
        dropIndex,
        collisions: 0,
        ticks: 0,
        settledPocket: null,
      });
      activeBodies.add(body);
      Matter.Composite.add(engine.world, body);
    }

    const handleCollision = (event: Matter.IEventCollision<Matter.Engine>): void => {
      for (const pair of event.pairs) {
        const candidates: Array<[Matter.Body, Matter.Body]> = [
          [pair.bodyA, pair.bodyB],
          [pair.bodyB, pair.bodyA],
        ];

        for (const [ball, other] of candidates) {
          if (ball.label !== BALL_LABEL) continue;
          const meta = bodyMeta.get(ball.id);
          if (!meta || meta.settledPocket !== null) continue;

          const pocketIndex = sensorPocketByBodyId.get(other.id);
          if (pocketIndex !== undefined) {
            meta.settledPocket = pocketIndex;
          } else if (!other.isSensor) {
            meta.collisions += 1;
          }
        }
      }
    };

    Matter.Events.on(engine, 'collisionStart', handleCollision);

    for (let tick = 1; tick <= maxTicks && activeBodies.size > 0; tick += 1) {
      Matter.Engine.update(engine, timestepMs);

      for (const body of Array.from(activeBodies)) {
        const meta = bodyMeta.get(body.id)!;
        meta.ticks = tick;

        if (meta.settledPocket !== null) {
          const multiplier = config.plinko.basePockets[meta.settledPocket] ?? 0;
          samples[meta.dropIndex] = {
            pocketIndex: meta.settledPocket,
            multiplier,
            collisions: meta.collisions,
            ticks: meta.ticks,
            stuck: false,
          };
          Matter.Composite.remove(engine.world, body);
          activeBodies.delete(body);
        }
      }
    }

    Matter.Events.off(engine, 'collisionStart', handleCollision);

    for (const body of activeBodies) {
      const meta = bodyMeta.get(body.id)!;
      samples[meta.dropIndex] = {
        pocketIndex: null,
        multiplier: 0,
        collisions: meta.collisions,
        ticks: meta.ticks || maxTicks,
        stuck: true,
      };
      Matter.Composite.remove(engine.world, body);
    }
  }

  Matter.Engine.clear(engine);
  return samples;
};
