import type Phaser from 'phaser';
import { sceneViewport } from './scenePresentation';
import { isPlinkoPerfMode } from '../../app/perfMode';
import { runtimeImageRequestPath } from '../../app/runtimeImages';

export type ProductionArtId = 'map' | 'barry-due' | 'barry-paid' | 'dishes' | 'trash' | 'courier' | 'casino' | 'plate' | 'bag' | 'bin' | 'crate' | 'courier-icon';
export const productionArtKey = (id: ProductionArtId): string => `67m:art:${id}`;

export const preloadProductionArt = (scene: Phaser.Scene, ids: readonly ProductionArtId[]): void => {
  for (const id of ids) {
    const key = productionArtKey(id);
    if (!scene.textures.exists(key)) scene.load.image(key, runtimeImageRequestPath(`art/${id}.webp`));
  }
};

export const addProductionImage = (scene: Phaser.Scene, id: ProductionArtId, x: number, y: number, width: number, height: number, depth = -1): Phaser.GameObjects.Image => {
  const image = scene.add.image(x,y,productionArtKey(id)).setDisplaySize(width,height).setDepth(depth);
  if (isPlinkoPerfMode() && new URLSearchParams(window.location.search).get('art') === 'off') image.setVisible(false);
  if (width === 1280 && height === 720) {
    const fit = () => {
      const view = sceneViewport(scene);
      const source = image.texture.getSourceImage();
      const cover = Math.max(view.width / source.width, view.height / source.height);
      image.setDisplaySize(source.width * cover, source.height * cover);
    };
    fit(); scene.scale.on('resize', fit);
    image.once('destroy', () => scene.scale.off('resize', fit));
  }
  return image;
};
