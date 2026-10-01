import Matter from 'matter-js';
import { describe, expect, it } from 'vitest';
import { physicsCheckpointSchema } from '../src/core/plinko-rules/physicsCheckpoint';
import { snapshotSolver, restoreSolver } from '../src/phaser/plinko/solverCheckpoint';
import { migrateSaveState } from '../src/core/save/migrations';
import { createSaveState } from '../src/core/save/SaveState';
import { createInitialGameState } from '../src/core/state/GameState';
import { balance } from '../src/config/balance';
import { commitBareDrop } from '../src/core/plinko-rules/drop';

const world = () => {
  const engine = Matter.Engine.create();
  const floor = Matter.Bodies.rectangle(0, 100, 400, 15, { isStatic: true, label: 'floor' });
  const peg = Matter.Bodies.circle(4, 50, 8, { isStatic: true, label: 'peg', restitution: 0.6 });
  const ball = Matter.Bodies.circle(0, 0, 10, { label: 'ball', restitution: 0.155, frictionAir: 0.023 });
  Matter.Composite.add(engine.world, [floor, peg, ball]);
  return { engine, ball, bodies: [floor, peg, ball], balls: new Map([[ball, 'test']]) };
};
describe('exact Matter solver checkpoints', () => {
  it('migrates v13 without refunding a committed stake or losing its transaction', () => {
    const initial = createInitialGameState(balance, 67);
    const committed = commitBareDrop(initial, null, balance, 'legacy', 1);
    const save = { ...createSaveState(committed.state), version: 13, pendingDrop: committed.pendingDrop };
    const restored = migrateSaveState(JSON.parse(JSON.stringify(save)));
    expect(restored.version).toBe(14);
    expect(restored.game.cash).toBe(0);
    expect(restored.pendingDrop).toEqual(committed.pendingDrop);
  });
  it.each([15, 23, 36, 55, 90, 120])('preserves a JSON-restored collision trajectory at tick %s', tick => {
    const original = world();
    for (let step = 0; step < tick; step++) Matter.Engine.update(original.engine, 1000 / 60);
    const saved = physicsCheckpointSchema.parse(JSON.parse(JSON.stringify(snapshotSolver(original.engine, original.bodies, original.balls))));
    const restored = world();
    restoreSolver(restored.engine, restored.bodies, restored.balls, saved);
    for (let step = 0; step < 180; step++) {
      Matter.Engine.update(original.engine, 1000 / 60); Matter.Engine.update(restored.engine, 1000 / 60);
      expect(restored.ball.position).toEqual(original.ball.position);
      expect(restored.ball.velocity).toEqual(original.ball.velocity);
      expect(restored.ball.angle).toEqual(original.ball.angle);
    }
  });
});
