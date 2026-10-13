import Phaser from 'phaser';
import { VISUAL_FONT, visualColor } from '../visual/visualTheme';

/** Fixed pools: presentation never changes physics, RNG or payout timing. */
export class PlinkoEffects {
  private readonly pulseImages: Phaser.GameObjects.Image[];
  private readonly pulses = Array.from({ length: 48 }, () => ({ x: 0, y: 0, born: -10000, color: 0, pocket: false }));
  private readonly labels: { text: Phaser.GameObjects.Text; born: number; y: number }[];
  private readonly trails: Phaser.GameObjects.Image[][];
  private cursor = 0;
  private labelCursor = 0;
  public constructor(private readonly scene: Phaser.Scene, parent: Phaser.GameObjects.Container, maxActiveBalls: number) {
    // Bake the four circles once. Graphics would rebuild and triangulate every
    // circle on every rendered frame (up to 96 circles at the legal ball cap).
    const radii = [4, 5, 6, 10];
    const keys = radii.map(radius => `67m:ball-trail:${radius}`);
    radii.forEach((radius, index) => {
      const key = keys[index]!;
      if (scene.textures.exists(key)) return;
      const stamp = scene.add.graphics();
      const size = radius * 2 + 2;
      stamp.fillStyle(visualColor(index === 3 ? 'paperOld' : 'mustard'));
      stamp.fillCircle(size / 2, size / 2, radius);
      stamp.generateTexture(key, size, size);
      stamp.destroy();
    });
    this.trails = Array.from({ length: maxActiveBalls }, () => keys.map((key, index) => {
      const image = scene.add.image(0, 0, key).setAlpha(index === 3 ? 0.12 : 0.16 / (3 - index)).setVisible(false);
      parent.add(image);
      return image;
    }));
    const pulseKey = '67m:pin-pulses';
    if (!scene.textures.exists(pulseKey)) {
      const stamp = scene.add.graphics();
      // One small atlas, including constant-width rings at each animation step.
      // The geometry follows the original 220/550 ms pulse; only presentation
      // is sampled at approximately 60 Hz. Physics and collision times stay exact.
      for (let frame = 0; frame < 50; frame += 1) {
        const pocket = frame >= 16;
        const t = pocket ? (frame - 16) / 34 : frame / 16;
        stamp.lineStyle(pocket ? 3 : 2, visualColor(pocket ? 'mustard' : 'cold'));
        stamp.strokeCircle(frame % 8 * 74 + 37, Math.floor(frame / 8) * 74 + 37, 5 + t * (pocket ? 29 : 13));
      }
      stamp.generateTexture(pulseKey, 8 * 74, 7 * 74);
      stamp.destroy();
      const texture = scene.textures.get(pulseKey);
      for (let frame = 0; frame < 50; frame += 1) texture.add(String(frame), 0, frame % 8 * 74, Math.floor(frame / 8) * 74, 74, 74);
    }
    this.pulseImages = this.pulses.map(() => {
      const image = scene.add.image(0, 0, pulseKey, '0').setVisible(false);
      parent.add(image);
      return image;
    });
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
    const now = this.scene.time.now;
    let index = 0;
    for (const body of balls) {
      const trail = this.trails[index++];
      if (!trail) break;
      for (let part = 0; part < trail.length; part += 1) {
        const image = trail[part]!;
        const step = part === 3 ? 0 : 3 - part;
        image.setPosition(body.position.x - body.velocity.x * step * 1.5, body.position.y - body.velocity.y * step * 1.5).setVisible(true);
      }
    }
    for (; index < this.trails.length; index += 1) for (const image of this.trails[index]!) image.setVisible(false);
    for (let index = 0; index < this.pulses.length; index += 1) {
      const pulse = this.pulses[index]!;
      const image = this.pulseImages[index]!;
      const t = (now - pulse.born) / (pulse.pocket ? 550 : 220);
      image.setVisible(t >= 0 && t < 1);
      if (t >= 0 && t < 1) {
        const frame = pulse.pocket ? 16 + Math.min(33, Math.floor(t * 34)) : Math.min(15, Math.floor(t * 16));
        image.setFrame(String(frame)).setPosition(pulse.x, pulse.y).setAlpha((1 - t) * 0.85);
      }
    }
    for (const label of this.labels) {
      const t = (now - label.born) / 900;
      label.text.setVisible(t >= 0 && t < 1);
      if (t >= 0 && t < 1) label.text.setY(label.y - 30 * t).setAlpha(1 - t * t);
    }
  }
}
