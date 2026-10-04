import Phaser from 'phaser';
import type { NeedsForecast } from '../actions/needsForecast';
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
  private forecast: NeedsForecast | null = null;
  private readonly forecastFade = { value: 1 };
  private forecastTween?: Phaser.Tweens.Tween;
  private readonly forecastText: Phaser.GameObjects.Text;
  private latestNeeds: HudNeed[] = [];
  private latestState?: GameState;
  private detailTimer?: Phaser.Time.TimerEvent;

  public constructor(private readonly scene: Phaser.Scene, private readonly config: BalanceConfig) {
    const depth = VISUAL_METRICS.hudDepth;
    this.graphics = scene.add.graphics().setDepth(depth);
    const text = (x: number, y: number, size = 18) => scene.add.text(x, y, '', {
      color: visualHex('textMain'), fontFamily: VISUAL_FONT.sans, fontSize: `${size}px`, fontStyle: 'bold',
    }).setDepth(depth + 1);
    this.heading = [text(30, 25, 16), text(254, 22, 23), text(574, 25, 17), text(1050, 25, 16)];
    this.forecastText = text(534, 103, 16).setColor(visualHex('mustard')).setBackgroundColor(visualHex('inkPanel')).setVisible(false);
    this.needTexts = Array.from({ length: 4 }, (_, index) => text(66 + index * 122, 82, 17));
    this.statusText = text(534, 80, 19).setInteractive({ useHandCursor: true });
    this.detail = text(24, 136, 22).setPadding(12, 10).setBackgroundColor(visualHex('inkPanel')).setWordWrapWidth(1160).setVisible(false);
    const show = (message: string) => {
      this.detailTimer?.remove(); this.detail.setText(message).setVisible(true);
      this.detailTimer = scene.time.delayedCall(6000, () => this.detail.setVisible(false));
    };
    this.heading[2]!.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      if (!this.latestState) return;
      const hud = deriveHudSnapshot(this.latestState, this.config);
      const missing = Math.max(0, hud.nextBarry - hud.cash);
      show(`До Барри: ${formatBarryCountdown(hud.minutesUntilBarry)} · платёж ${hud.nextBarry.toLocaleString('ru-RU')} ₽\n${missing ? `Не хватает ${missing.toLocaleString('ru-RU')} ₽` : 'Денег на ближайший платёж хватает.'}`);
    });
    this.heading[3]!.setInteractive({ useHandCursor: true }).on('pointerup', () => show('Основной долг: 67 000 000 ₽. Погашается целиком на карте.\nЕжедневные платежи Барри не уменьшают основной долг.'));
    this.statusText.on('pointerup', () => show('Запах: прими душ, чтобы снять статус.'));
    for (let index = 0; index < 4; index += 1) {
      scene.add.zone(80 + index * 122, 99, 116, 52).setDepth(depth + 2)
        .setInteractive({ useHandCursor: true }).on('pointerup', () => {
          const need = this.latestNeeds[index];
          if (need) {
            const help = { health: 'При нуле — конец игры. Восстановись едой или сном.', satiety: 'Поешь в закусочной. Голод опасен для здоровья.', energy: 'Поспи в комнате. Энергия нужна для работы.', happiness: 'Отдохни в квартале отдыха.' };
            show(`${need.id === 'health' ? 'Здоровье' : need.label}: ${Math.round(need.value)} / ${this.config.needs.max}\n${help[need.id]}`);
          }
        });
    }
  }

  public setForecast(forecast: NeedsForecast | null): void {
    if (JSON.stringify(forecast) === JSON.stringify(this.forecast)) return;
    this.forecast = forecast;
    this.forecastTween?.stop();
    this.forecastFade.value = 0;
    this.forecastTween = this.scene.tweens.add({ targets: this.forecastFade, value: 1, duration: 180,
      onUpdate: () => { if (this.latestState) this.render(this.latestState); } });
    if (this.latestState) this.render(this.latestState);
    this.scene.game.canvas.setAttribute('data-needs-forecast', forecast ? JSON.stringify(forecast.needs) : '');
  }

  public render(state: GameState): void {
    this.latestState = state;
    const hud = deriveHudSnapshot(state, this.config);
    this.latestNeeds = hud.needs;
    const g = this.graphics.clear();
    g.fillStyle(visualColor('inkPanel'), 0.94); g.fillRoundedRect(14, 12, 1252, 48, 14);
    this.heading[0]!.setText(`День ${hud.day} · ${hud.time}`);
    this.heading[1]!.setText(`${hud.cash.toLocaleString('ru-RU')} ₽`);
    const due = hud.minutesUntilBarry === 0 ? 'сейчас' : hud.minutesUntilBarry <= 180 ? `через ${formatBarryCountdown(hud.minutesUntilBarry)}` : 'в 09:00';
    const shortfall = Math.max(0, hud.nextBarry - hud.cash);
    this.heading[2]!.setText(`Барри ${due} · ${hud.nextBarry.toLocaleString('ru-RU')} ₽`)
      .setColor(visualHex(shortfall > 0 && hud.minutesUntilBarry <= 180 ? 'warning' : 'textMain'));
    this.heading[3]!.setText(hud.cash >= hud.mainDebt ? 'Долг можно погасить' : 'Цель: 67 млн ₽').setColor(visualHex('mustard'));
    this.heading.forEach((heading, index) => {
      const maxWidth = [210, 300, 455, 194][index]!;
      const base = [16, 23, 17, 16][index]!;
      heading.setFontSize(base);
      if (heading.width > maxWidth) heading.setFontSize(Math.max(12, Math.floor(base * maxWidth / heading.width)));
    });
    this.statusText.setText(hud.statuses.length ? 'Запах · нужен душ' : '').setVisible(hud.statuses.length > 0);
    this.forecastText.setText(this.forecast?.caption ?? '').setVisible(this.forecast !== null);
    hud.needs.forEach((need, index) => {
      const x = 24 + index * 122;
      const low = need.value <= this.config.needs.lowThreshold;
      const color = visualColor(low ? 'warning' : 'good');
      g.fillStyle(visualColor('inkPanel'), 0.92); g.fillRoundedRect(x - 6, 74, 116, 49, 13);
      drawNeedIcon(g, need.id, x + 17, 96, low ? color : visualColor('paperOld'));
      this.needTexts[index]!.setText(low ? ({ health: 'Опасно', satiety: 'Голод', energy: 'Устал', happiness: 'Грусть' }[need.id]) : '').setFontSize(17).setColor(visualHex(low ? 'warning' : 'textMain'));
      g.fillStyle(visualColor('inkRaised'), 1); g.fillRoundedRect(x + 41, low || this.forecast ? 108 : 92, 56, 8, 3);
      const width = 56 * Phaser.Math.Clamp(need.value / this.config.needs.max, 0, 1);
      if (width > 0) { g.fillStyle(color, 1); g.fillRoundedRect(x + 41, low || this.forecast ? 108 : 92, width, 8, 3); }
      if (this.forecast) {
        const value = this.forecast.needs[need.id];
        const projected = 56 * Phaser.Math.Clamp(value / this.config.needs.max, 0, 1);
        const from = Math.min(width, projected);
        g.fillStyle(visualColor(value >= need.value ? 'mustard' : 'warning'), this.forecastFade.value * 0.85);
        g.fillRect(x + 41 + from, 109, Math.max(2, Math.abs(projected - width)), 6);
        this.needTexts[index]!.setText(`${Math.round(need.value)}→${Math.round(value)}`).setFontSize(16);
      }
    });
  }
}
