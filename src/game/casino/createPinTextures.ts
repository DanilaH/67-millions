import type Phaser from 'phaser';
import { SPECIAL_PIN_STYLE, visualColor } from '../visual/visualTheme';

/** Small shared glyphs avoid rebuilding circle geometry for every static pin/frame. */
export const createPinTextures = (scene: Phaser.Scene, radius: number): void => {
  const size = Math.ceil((radius + 6) * 2), center = size / 2;
  for (const role of ['regular', 'amplifier', 'return', 'splitter'] as const) {
    const key = `67m:pin:${role}`;
    if (scene.textures.exists(key)) continue;
    const stamp = scene.add.graphics();
    const special = role !== 'regular';
    stamp.fillStyle(special ? SPECIAL_PIN_STYLE[role].color : visualColor('lineDirty'), 1);
    stamp.fillCircle(center, center, radius + (role === 'amplifier' ? 4 : special ? 3 : 0));
    if (role === 'amplifier') {
      stamp.fillStyle(visualColor('inkDeep'), 1);
      stamp.fillCircle(center, center, Math.max(2, radius - 1));
    } else if (role === 'return' || role === 'splitter') {
      stamp.lineStyle(2, visualColor('inkDeep'), 1);
      if (role === 'return') {
        stamp.lineBetween(center, center + 4, center, center - 5);
        stamp.lineBetween(center, center - 5, center - 4, center - 1);
        stamp.lineBetween(center, center - 5, center + 4, center - 1);
      } else {
        stamp.lineBetween(center, center + 4, center, center);
        stamp.lineBetween(center, center, center - 4, center - 4);
        stamp.lineBetween(center, center, center + 4, center - 4);
      }
    }
    stamp.generateTexture(key, size, size); stamp.destroy();
  }
};
