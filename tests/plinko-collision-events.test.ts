import Matter from 'matter-js';
import { describe, expect, it } from 'vitest';
import { dispatchPlinkoCollisions } from '../src/phaser/plinko/collisionEvents';

describe('Phaser Plinko collision batches', () => {
  it('handles every simultaneous ball/peg/pocket pair in either body order', () => {
    const body = (label: string) => Matter.Bodies.circle(0, 0, 10, { label }) as unknown as MatterJS.BodyType;
    const first = body('plinko:ball'), second = body('plinko:ball'), third = body('plinko:ball');
    const pockets: unknown[] = [], pegs: unknown[] = [];
    dispatchPlinkoCollisions([
      { bodyA: first, bodyB: body('plinko:pocket:0') },
      { bodyA: body('plinko:peg:row-2:pin-1'), bodyB: second },
      { bodyA: body('plinko:wall'), bodyB: body('plinko:divider') },
      { bodyA: body('plinko:pocket:9'), bodyB: third },
    ], { onPocket: (index, ball) => pockets.push([index, ball.id]), onPeg: (id, ball) => pegs.push([id, ball.id]) });
    expect(pockets).toEqual([[0, first.id], [9, third.id]]);
    expect(pegs).toEqual([['row-2:pin-1', second.id]]);
  });
});
