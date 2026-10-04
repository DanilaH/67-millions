import type Phaser from 'phaser';
import { installSceneTextSharpness } from '@danilah/mini-games-kit/phaser';
import { resolveGameViewport } from '../../app/viewportLayout';

/** Keep gameplay coordinates logical while rendering into a denser backing store. */
export const installScenePresentation = (scene: Phaser.Scene): void => {
  scene.game.canvas.style.backgroundImage = '';
  scene.game.canvas.style.backgroundSize = '100% 100%';
  const sync = () => {
    const layout = resolveGameViewport(scene.scale.width, scene.scale.height);
    const ratio = layout.scale;
    scene.cameras.main.setOrigin(0, 0).setScroll(layout.left, layout.top).setSize(scene.scale.width, scene.scale.height).setZoom(ratio);
    const sharpen = (children: Phaser.GameObjects.GameObject[]) => {
      for (const child of children) {
        if ('setResolution' in child && typeof child.setResolution === 'function') child.setResolution(Math.max(1, ratio));
        const nested = (child as Phaser.GameObjects.Container).list;
        if (Array.isArray(nested)) sharpen(nested);
      }
    };
    sharpen(scene.children.list);
  };
  installSceneTextSharpness(scene, () => Math.max(1, resolveGameViewport(scene.scale.width, scene.scale.height).scale));
  scene.scale.on('resize', sync);
  scene.events.once('shutdown', () => scene.scale.off('resize', sync));
  sync();
};

export const logicalPointer = (scene: Phaser.Scene, pointer: Phaser.Input.Pointer): { x: number; y: number } =>
  scene.cameras.main.getWorldPoint(pointer.x, pointer.y);

export const sceneViewport = (scene: Phaser.Scene) => resolveGameViewport(scene.scale.width, scene.scale.height);
