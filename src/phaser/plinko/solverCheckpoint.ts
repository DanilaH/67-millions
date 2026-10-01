import type { PhysicsCheckpoint } from '../../core/plinko-rules/physicsCheckpoint';

// Matter's public typings omit its solver cache. Keep the structural adapter local.
interface Vertex { x: number; y: number; index: number; isInternal: boolean; body: Body }
interface Body {
  id: number; label: string; isStatic: boolean;
  position: { x: number; y: number }; vertices: Vertex[];
}
type Collision = Omit<PhysicsCheckpoint['pairs'][number]['collision'], 'supports'> & {
  bodyA: Body; bodyB: Body; parentA: Body; parentB: Body; pair?: Pair;
};

type Pair = PhysicsCheckpoint['pairs'][number]['state'] & {
  id: string; bodyA: Body; bodyB: Body;
  collision: Collision & { supports: (Vertex | null)[] };
  contacts: { vertex: Vertex | null; normalImpulse: number; tangentImpulse: number }[];
};
interface Engine {
  timing: PhysicsCheckpoint['timing'];
  world: { isModified: boolean };
  pairs: { list: Pair[]; table: Record<string, Pair>; collisionStart: Pair[]; collisionActive: Pair[]; collisionEnd: Pair[] };
}
const bodyFields = ['position', 'positionPrev', 'velocity', 'force', 'positionImpulse', 'constraintImpulse', 'angle', 'anglePrev', 'angularVelocity', 'torque', 'speed', 'angularSpeed', 'deltaTime', 'totalContacts', 'axes', 'bounds'] as const;
const pairFields = ['contactCount', 'separation', 'isActive', 'isSensor', 'timeCreated', 'timeUpdated', 'inverseMass', 'friction', 'frictionStatic', 'restitution', 'slop'] as const;
const collisionFields = ['depth', 'collided', 'normal', 'tangent', 'penetration', 'supportCount'] as const;
const select = (object: object, keys: readonly string[]) => structuredClone(Object.fromEntries(keys.map(key => [key, (object as Record<string, unknown>)[key]])));
const staticKey = (body: Body) => `static:${body.label}:${body.position.x}:${body.position.y}`;
const mapBodies = (bodies: readonly Body[], balls: ReadonlyMap<Body, string>) => new Map(bodies.map(body => [balls.has(body) ? `ball:${balls.get(body)}` : staticKey(body), body]));

export const snapshotSolver = (rawEngine: unknown, rawBodies: readonly unknown[], rawBalls: ReadonlyMap<unknown, string>): PhysicsCheckpoint => {
  const engine = rawEngine as Engine, bodies = rawBodies as Body[], balls = rawBalls as ReadonlyMap<Body, string>;
  const byKey = mapBodies(bodies, balls), byBody = new Map([...byKey].map(([key, body]) => [body, key]));
  const reference = (vertex: Vertex | null) => vertex ? { body: byBody.get(vertex.body)!, index: vertex.index } : null;
  return {
    version: 1, timing: select(engine.timing, ['timestamp', 'timeScale', 'lastDelta']) as PhysicsCheckpoint['timing'],
    bodies: [...balls].map(([body, id]) => ({
      key: `ball:${id}`,
      state: { ...select(body, bodyFields), vertices: body.vertices.map(({ x, y, index, isInternal }) => ({ x, y, index, isInternal })) } as PhysicsCheckpoint['bodies'][number]['state'],
    })),
    pairs: engine.pairs.list.filter(pair => byBody.has(pair.bodyA) && byBody.has(pair.bodyB)).map(pair => ({
      bodyA: byBody.get(pair.bodyA)!, bodyB: byBody.get(pair.bodyB)!,
      state: select(pair, pairFields) as PhysicsCheckpoint['pairs'][number]['state'],
      collision: { ...select(pair.collision, collisionFields), supports: pair.collision.supports.map(reference) } as PhysicsCheckpoint['pairs'][number]['collision'],
      contacts: pair.contacts.map(contact => ({ ...select(contact, ['normalImpulse', 'tangentImpulse']), vertex: reference(contact.vertex) })) as PhysicsCheckpoint['pairs'][number]['contacts'],
    })),
  };
};

export const restoreSolver = (rawEngine: unknown, rawBodies: readonly unknown[], rawBalls: ReadonlyMap<unknown, string>, snapshot: PhysicsCheckpoint): void => {
  const engine = rawEngine as Engine, bodies = rawBodies as Body[], balls = rawBalls as ReadonlyMap<Body, string>;
  const byKey = mapBodies(bodies, balls);
  const bodyAt = (key: string) => { const body = byKey.get(key); if (!body) throw new Error(`Missing checkpoint body: ${key}`); return body; };
  for (const { key, state } of snapshot.bodies) {
    const body = bodyAt(key);
    Object.assign(body, select(state, bodyFields));
    body.vertices = state.vertices.map(vertex => ({ ...vertex, body }));
  }
  const vertexAt = (ref: PhysicsCheckpoint['pairs'][number]['contacts'][number]['vertex']) => {
    if (!ref) return null;
    const vertex = bodyAt(ref.body).vertices[ref.index];
    if (!vertex) throw new Error('Invalid checkpoint vertex');
    return vertex;
  };
  const pairs = snapshot.pairs.map(saved => {
    const bodyA = bodyAt(saved.bodyA), bodyB = bodyAt(saved.bodyB);
    const id = bodyA.id < bodyB.id ? `${bodyA.id.toString(36)}:${bodyB.id.toString(36)}` : `${bodyB.id.toString(36)}:${bodyA.id.toString(36)}`;
    const collision = { ...select(saved.collision, collisionFields), bodyA, bodyB, parentA: bodyA, parentB: bodyB, supports: saved.collision.supports.map(vertexAt) } as Pair['collision'];
    const pair = { ...saved.state, id, bodyA, bodyB, collision, contacts: saved.contacts.map(contact => ({ ...contact, vertex: vertexAt(contact.vertex) })) };
    collision.pair = pair;
    return pair;
  });
  Object.assign(engine.timing, snapshot.timing);
  Object.assign(engine.pairs, { list: pairs, table: Object.fromEntries(pairs.map(pair => [pair.id, pair])), collisionStart: [], collisionActive: [], collisionEnd: [] });
  engine.world.isModified = true;
};
