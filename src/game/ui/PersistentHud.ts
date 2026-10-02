import Phaser from 'phaser';
import type { BalanceConfig } from '../../config/balance.schema';
import type { GameState } from '../../core/state/GameState';
import { VISUAL_FONT, VISUAL_METRICS, visualColor, visualHex } from '../visual/visualTheme';
import { deriveHudSnapshot, formatBarryCountdown, type HudNeed } from './hudModel';

/** Vector icons stay readable without an emoji font or raster sprite scaling. */
const drawNeedIcon = (g: Phaser.GameObjects.Graphics, id: HudNeed['id'], x: number, y: number, color: number): void => {
  g.lineStyle(2, color, 1); g.fillStyle(color, 1);
  if (id === 'health') {
    g.fillCircle(x - 5, y - 4, 6); g.fillCircle(x + 5, y - 4, 6);
    g.fillTriangle(x - 11, y - 2, x + 11, y - 2, x, y + 12);
  } else if (id === 'satiety') {
    for (const offset of [-8, -4, 0]) g.lineBetween(x + offset, y - 10, x + offset, y);
    g.lineBetween(x - 8, y, x, y); g.lineBetween(x - 4, y, x - 4, y + 11);
    g.lineBetween(x + 8, y - 10, x + 8, y + 11); g.fillRoundedRect(x + 4, y - 10, 5, 12, 2);
  } else if (id === 'energy') {
    g.strokeRoundedRect(x - 12, y - 7, 22, 15, 3); g.fillRect(x + 10, y - 3, 3, 7);
    g.fillRect(x - 8, y - 3, 13, 7);
  } else {
    g.strokeCircle(x, y, 11); g.fillCircle(x - 4, y - 3, 1.5); g.fillCircle(x + 4, y - 3, 1.5);
    g.beginPath(); g.arc(x, y, 6, 0.15, Math.PI - 0.15); g.strokePath();
  }
};

export class PersistentHud {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly heading: Phaser.GameObjects.Text[];
  private readonly needTexts: Phaser.GameObjects.Text[];
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly detail: Phaser.GameObjects.Text;
  private latestNeeds: HudNeed[] = [];
  private detailTimer?: Phaser.Time.TimerEvent;

  public constructor(scene: Phaser.Scene, private readonly config: BalanceConfig) {
    const depth = VISUAL_METRICS.hudDepth;
    this.graphics = scene.add.graphics().setDepth(depth);
    const text = (x: number, y: number, size = 18) => scene.add.text(x, y, '', {
      color: visualHex('textMain'), fontFamily: VISUAL_FONT.sans, fontSize: `${size}px`, fontStyle: 'bold',
    }).setDepth(depth + 1);
    this.heading = [text(30, 25), text(254, 22, 23), text(574, 25, 17), text(1020, 25, 16)];
    this.needTexts = Array.from({ length: 4 }, (_, index) => text(66 + index * 122, 82, 17));
    this.statusText = text(534, 80, 19).setInteractive({ useHandCursor: true });
    this.detail = text(24, 136, 16).setPadding(12, 10).setBackgroundColor(visualHex('inkPanel')).setVisible(false);
    const show = (message: string) => {
      this.detailTimer?.remove(); this.detail.setText(message).setVisible(true);
      this.detailTimer = scene.time.delayedCall(3500, () => this.detail.setVisible(false));
    };
    this.statusText.on('pointerup', () => show('Запах: прими душ, чтобы снять статус.'));
    for (let index = 0; index < 4; index += 1) {
      scene.add.zone(80 + index * 122, 99, 116, 52).setDepth(depth + 2)
        .setInteractive({ useHandCursor: true }).on('pointerup', () => {
          const need = this.latestNeeds[index];
          if (need) show(`${need.id === 'health' ? 'Здоровье' : need.label}: ${Math.round(need.value)} / ${this.config.needs.max}`);
        });
    }
  }

  public render(state: GameState): void {
    const hud = deriveHudSnapshot(state, this.config);
    this.latestNeeds = hud.needs;
    const g = this.graphics.clear();
    g.fillStyle(visualColor('inkPanel'), 0.94); g.fillRoundedRect(14, 12, 1252, 48, 14);
    this.heading[0]!.setText(`День ${hud.day} · ${hud.time}`);
    this.heading[1]!.setText(`${hud.cash.toLocaleString('ru-RU')} ₽`);
    this.heading[2]!.setText(`Барри ${hud.nextBarry.toLocaleString('ru-RU')} ₽ · ${hud.minutesUntilBarry === 0 ? 'сейчас' : formatBarryCountdown(hud.minutesUntilBarry)}`);
    this.heading[3]!.setText(`Долг ${hud.mainDebt.toLocaleString('ru-RU')} ₽`).setColor(visualHex('mustard'));
    this.statusText.setText(hud.statuses.length ? '≋' : '').setVisible(hud.statuses.length > 0);
    hud.needs.forEach((need, index) => {
      const x = 24 + index * 122;
      const low = need.value <= this.config.needs.lowThreshold;
      const color = visualColor(low ? 'warning' : 'good');
      g.fillStyle(visualColor('inkPanel'), 0.92); g.fillRoundedRect(x - 6, 74, 116, 49, 13);
      drawNeedIcon(g, need.id, x + 17, 96, low ? color : visualColor('paperOld'));
      this.needTexts[index]!.setText(`${Math.round(need.value)}`).setColor(visualHex(low ? 'warning' : 'textMain'));
      g.fillStyle(visualColor('inkRaised'), 1); g.fillRoundedRect(x + 41, 108, 56, 5, 2);
      const width = 56 * Phaser.Math.Clamp(need.value / this.config.needs.max, 0, 1);
      if (width > 0) { g.fillStyle(color, 1); g.fillRoundedRect(x + 41, 108, width, 5, 2); }
    });
  }
}
