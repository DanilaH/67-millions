import type Phaser from 'phaser';
import { installSceneTextSharpness } from '@danilah/mini-games-kit/phaser';
import { balance } from '../../config/balance';

/** Keep gameplay coordinates logical while rendering into a denser backing store. */
export const installScenePresentation = (scene: Phaser.Scene): void => {
  const sync = () => {
    const ratio = scene.scale.width / balance.plinko.geometry.logicalViewportWidth;
    scene.cameras.main.setOrigin(0, 0).setScroll(0, 0).setSize(scene.scale.width, scene.scale.height).setZoom(ratio);
    const sharpen = (children: Phaser.GameObjects.GameObject[]) => {
      for (const child of children) {
        if ('setResolution' in child && typeof child.setResolution === 'function') child.setResolution(Math.max(1, ratio));
        const nested = (child as Phaser.GameObjects.Container).list;
        if (Array.isArray(nested)) sharpen(nested);
      }
    };
    sharpen(scene.children.list);
  };
  installSceneTextSharpness(scene, () => Math.max(1, scene.scale.width / balance.plinko.geometry.logicalViewportWidth));
  scene.scale.on('resize', sync);
  scene.events.once('shutdown', () => scene.scale.off('resize', sync));
  sync();
};

export const logicalPointer = (scene: Phaser.Scene, pointer: Phaser.Input.Pointer): { x: number; y: number } =>
  scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
