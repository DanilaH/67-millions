import type Phaser from 'phaser';
import { VISUAL_FONT, visualHex, type VisualColorToken } from '../visual/visualTheme';

// At most one label per completed plate/bag or delivery, never per pointer event.
export const showInteractionFeedback = (scene: Phaser.Scene, x: number, y: number, text: string, color: VisualColorToken = 'mustard'): void => {
  const label = scene.add.text(Math.max(200, Math.min(1080, x)), y, text, {
    fontFamily: VISUAL_FONT.sans, fontSize: '26px', fontStyle: 'bold', color: visualHex(color),
    stroke: visualHex('inkDeep'), strokeThickness: 5,
  }).setOrigin(0.5).setDepth(50);
  scene.tweens.add({ targets: label, y: y - 24, alpha: 0, duration: 650, onComplete: () => label.destroy() });
};
