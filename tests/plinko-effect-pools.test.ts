import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { PlinkoEffects } from '../src/game/casino/PlinkoEffects';

vi.mock('phaser', () => ({ default: {} }));

const fixture = () => {
  const children: ReturnType<typeof object>[] = [];
  const object = () => {
    const value = { visible: false, x: 0, y: 0,
      setVisible(visible: boolean) { this.visible = visible; return this; },
      setPosition(x: number, y: number) { this.x = x; this.y = y; return this; },
      setAlpha() { return this; }, setFrame() { return this; }, setText() { return this; },
      setOrigin() { return this; }, setY(y: number) { this.y = y; return this; },
    };
    return value;
  };
  const graphics = { fillStyle() { return this; }, lineStyle() { return this; },
    fillCircle: vi.fn(), strokeCircle: vi.fn(), generateTexture: vi.fn(), destroy: vi.fn(),
  };
  const addGraphics = vi.fn(() => graphics);
  const scene = { time: { now: 0 }, textures: { exists: () => false, get: () => ({ add: vi.fn() }) },
    add: { graphics: addGraphics, image: object, text: object },
  };
  const parent = { add: (child: ReturnType<typeof object>) => children.push(child) };
  const effects = new PlinkoEffects(scene as unknown as Phaser.Scene, parent as unknown as Phaser.GameObjects.Container, 24);
  return { scene, effects, children, addGraphics, graphics };
};

describe('bounded Plinko effect pools', () => {
  it('does not allocate objects or rebuild circles while rendering a full board', () => {
    const { effects, children, addGraphics, graphics } = fixture();
    const balls = Array.from({ length: 24 }, (_, i) => ({ position: { x: 400 + i, y: 300 }, velocity: { x: 2, y: 3 } }));
    const before = { children: children.length, graphics: addGraphics.mock.calls.length, fills: graphics.fillCircle.mock.calls.length, rings: graphics.strokeCircle.mock.calls.length };
    for (let frame = 0; frame < 1000; frame += 1) effects.render(balls as MatterJS.BodyType[]);
    expect(children.length).toBe(before.children);
    expect(addGraphics).toHaveBeenCalledTimes(before.graphics);
    expect(graphics.fillCircle).toHaveBeenCalledTimes(before.fills);
    expect(graphics.strokeCircle).toHaveBeenCalledTimes(before.rings);
    expect(children.filter(child => child.visible)).toHaveLength(24 * 4);
    effects.render([]);
    expect(children.some(child => child.visible)).toBe(false);
  });

  it('reuses a fixed pulse pool and hides expired feedback', () => {
    const { effects, scene, children } = fixture();
    for (let i = 0; i < 500; i += 1) effects.hit(i, 300, i % 2 === 0);
    effects.payout(500, 600, 123);
    effects.render([]);
    expect(children.filter(child => child.visible)).toHaveLength(49);
    scene.time.now = 1000;
    effects.render([]);
    expect(children.some(child => child.visible)).toBe(false);
  });
});
