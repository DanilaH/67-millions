import { z } from 'zod';

const number = z.number().finite();
const vector = z.object({ x: number, y: number });
const vertexRef = z.object({ body: z.string(), index: z.number().int().nonnegative() }).nullable();
const bodyState = z.object({
  position: vector, positionPrev: vector, velocity: vector, force: vector,
  positionImpulse: vector, constraintImpulse: vector.extend({ angle: number }),
  angle: number, anglePrev: number, angularVelocity: number, torque: number,
  speed: number, angularSpeed: number, deltaTime: number, totalContacts: number,
  vertices: z.array(vector.extend({ index: z.number().int().nonnegative(), isInternal: z.boolean() })).min(3).max(64),
  axes: z.array(vector).max(64), bounds: z.object({ min: vector, max: vector }),
});
const pairState = z.object({
  contactCount: number, separation: number, isActive: z.boolean(), isSensor: z.boolean(),
  timeCreated: number, timeUpdated: number, inverseMass: number, friction: number,
  frictionStatic: number, restitution: number, slop: number,
});

/** Finite solver state, independent of Phaser objects and circular Matter references. */
export const physicsCheckpointSchema = z.object({
  version: z.literal(1),
  timing: z.object({ timestamp: number, timeScale: number, lastDelta: number }),
  bodies: z.array(z.object({ key: z.string(), state: bodyState })).max(24),
  pairs: z.array(z.object({
    bodyA: z.string(), bodyB: z.string(), state: pairState,
    collision: z.object({
      depth: number, collided: z.boolean(), normal: vector, tangent: vector,
      penetration: vector, supportCount: number, supports: z.array(vertexRef).max(2),
    }),
    contacts: z.array(z.object({ vertex: vertexRef, normalImpulse: number, tangentImpulse: number })).max(2),
  })).max(4096),
});
export type PhysicsCheckpoint = z.infer<typeof physicsCheckpointSchema>;
