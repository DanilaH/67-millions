import { expect, it } from 'vitest';
import { resolveGameViewport } from '../src/app/viewportLayout';

it.each([[1280, 720], [844, 390], [1024, 768], [2560, 1080]])('fills %i × %i without stretching the physical board', (width, height) => {
  const view = resolveGameViewport(width, height);
  expect(view.width * view.scale).toBeCloseTo(width);
  expect(view.height * view.scale).toBeCloseTo(height);
  expect(view.width).toBeGreaterThanOrEqual(1280);
  expect(view.height).toBeGreaterThanOrEqual(720);
  expect((640 - view.left) * view.scale).toBeCloseTo(width / 2);
  expect((360 - view.top) * view.scale).toBeCloseTo(height / 2);
});
