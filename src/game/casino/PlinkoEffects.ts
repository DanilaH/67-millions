import Phaser from 'phaser';
import { VISUAL_FONT, visualColor } from '../visual/visualTheme';

/** Fixed pools: presentation never changes physics, RNG or payout timing. */
export class PlinkoEffects {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly pulses = Array.from({ length: 48 }, () => ({ x: 0, y: 0, born: -10000, color: 0, pocket: false }));
  private readonly labels: { text: Phaser.GameObjects.Text; born: number; y: number }[];
  private cursor = 0;
  private labelCursor = 0;
  public constructor(private readonly scene: Phaser.Scene, parent: Phaser.GameObjects.Container) {
    this.graphics = scene.add.graphics(); parent.add(this.graphics);
    this.labels = Array.from({ length: 8 }, () => {
      const text = scene.add.text(0, 0, '', { fontFamily: VISUAL_FONT.sans, fontSize: '19px', fontStyle: 'bold', color: '#ffda78', stroke: '#11151b', strokeThickness: 4 }).setOrigin(0.5).setVisible(false);
      parent.add(text); return { text, born: -10000, y: 0 };
    });
  }
  public hit(x: number, y: number, pocket = false): void {
    const pulse = this.pulses[this.cursor++ % this.pulses.length]!;
    Object.assign(pulse, { x, y, pocket, born: this.scene.time.now, color: visualColor(pocket ? 'mustard' : 'cold') });
  }
  public payout(x: number, y: number, amount: number): void {
    this.hit(x, y, true);
    const label = this.labels[this.labelCursor++ % this.labels.length]!;
    label.born = this.scene.time.now; label.y = y;
    label.text.setText(`+${amount.toLocaleString('ru-RU')} ₽`).setPosition(x, y).setVisible(true).setAlpha(1);
  }
  public render(balls: Iterable<MatterJS.BodyType>): void {
    const g = this.graphics.clear(); const now = this.scene.time.now;
    for (const body of balls) {
      for (let step = 3; step > 0; step -= 1) {
        g.fillStyle(visualColor('mustard'), 0.16 / step);
        g.fillCircle(body.position.x - body.velocity.x * step * 1.5, body.position.y - body.velocity.y * step * 1.5, 7 - step);
      }
      g.fillStyle(visualColor('paperOld'), 0.12); g.fillCircle(body.position.x, body.position.y, 10);
    }
    for (const pulse of this.pulses) {
      const t = (now - pulse.born) / (pulse.pocket ? 550 : 220);
      if (t < 0 || t >= 1) continue;
      g.lineStyle(pulse.pocket ? 3 : 2, pulse.color, (1 - t) * 0.85);
      g.strokeCircle(pulse.x, pulse.y, 5 + t * (pulse.pocket ? 29 : 13));
    }
    for (const label of this.labels) {
      const t = (now - label.born) / 900;
      label.text.setVisible(t >= 0 && t < 1);
      if (t >= 0 && t < 1) label.text.setY(label.y - 30 * t).setAlpha(1 - t * t);
    }
  }
}
