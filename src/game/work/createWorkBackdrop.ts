import type Phaser from 'phaser';
import { addProductionImage, type ProductionArtId } from '../visual/productionArt';
import { visualColor } from '../visual/visualTheme';

/** A single frame for the painted scene; interaction coordinates stay unchanged. */
export const createWorkBackdrop = (scene: Phaser.Scene, art: ProductionArtId): void => {
  const frame = { x: 100, y: 112, width: 1080, height: 525, radius: 28 };
  const image = addProductionImage(scene, art, 640, 374.5, frame.width, frame.height);
  const clip = scene.add.graphics().setVisible(false);
  clip.fillStyle(0xffffff).fillRoundedRect(frame.x, frame.y, frame.width, frame.height, frame.radius);
  const mask = clip.createGeometryMask();
  image.setMask(mask);
  scene.add.graphics().setDepth(-0.5)
    .lineStyle(4, visualColor('lineDirty'))
    .strokeRoundedRect(frame.x, frame.y, frame.width, frame.height, frame.radius);
  image.once('destroy', () => { mask.destroy(); clip.destroy(); });
};
