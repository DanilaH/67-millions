import type Phaser from 'phaser';
import Matter from 'matter-js';
import { expect, it } from 'vitest';
import { balance } from '../src/config/balance';
import { createBarePlinko } from '../src/phaser/plinko/createBarePlinko';

it('applies every collision after the solver and before the checkpoint, even without a microtask between ticks', () => {
  const engine = Matter.Engine.create();
  type Handler = (event?: { pairs: { bodyA: Matter.Body; bodyB: Matter.Body }[] }) => void;
  const handlers = new Map<string, Handler>();
  const adapter = { matter: { set60Hz() {}, body: Matter.Body, add: {
    circle: Matter.Bodies.circle, rectangle: Matter.Bodies.rectangle,
  }, world: { engine, setGravity() {}, remove() {},
    on(name: string, fn: Handler) { handlers.set(name, fn); },
    off(name: string) { handlers.delete(name); },
  } } };
  const order: string[] = [];
  const runtime = createBarePlinko(adapter as unknown as Phaser.Scene, balance, { next: () => .5 }, {
    onFixedTick: tick => order.push(`clock:${tick}`),
    onPeg: id => order.push(`peg:${id}`),
    onPocket: index => order.push(`pocket:${index}`),
    onAfterFixedTick: tick => order.push(`checkpoint:${tick}`),
  });
  const ball = Matter.Bodies.circle(0, 0, 10, { label: 'plinko:ball' });
  const peg = Matter.Bodies.circle(0, 0, 6, { label: 'plinko:peg:r4c2' });
  const pocket = Matter.Bodies.rectangle(0, 0, 10, 10, { label: 'plinko:pocket:4' });
  try {
    handlers.get('collisionstart')!({ pairs: [{ bodyA: ball, bodyB: peg }] });
    expect(order).toEqual([]); // Never mutate bodies during collision solving.
    handlers.get('afterupdate')!();
    handlers.get('collisionstart')!({ pairs: [{ bodyA: pocket, bodyB: ball }] });
    handlers.get('afterupdate')!(); // Same JS stack, as in a slow render frame.
    expect(order).toEqual(['clock:1', 'peg:r4c2', 'checkpoint:1', 'clock:2', 'pocket:4', 'checkpoint:2']);
    handlers.get('afterupdate')!();
    expect(order.slice(6)).toEqual(['clock:3', 'checkpoint:3']); // No duplicated collision.
  } finally { runtime.destroy(); }
});
