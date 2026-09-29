import Phaser from 'phaser';

import type { BalanceConfig } from '../../config/balance.schema';
import type { GameState } from '../../core/state/GameState';
import {
  VISUAL_FONT,
  VISUAL_METRICS,
  visualColor,
  visualHex,
} from '../visual/visualTheme';
import {
  deriveHudSnapshot,
  formatBarryCountdown,
} from './hudModel';

export class PersistentHud {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly timeText: Phaser.GameObjects.Text;
  private readonly cashText: Phaser.GameObjects.Text;
  private readonly barryText: Phaser.GameObjects.Text;
  private readonly debtText: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly needTexts: Phaser.GameObjects.Text[];

  public constructor(
    scene: Phaser.Scene,
    private readonly config: BalanceConfig,
  ) {
    this.graphics = scene.add.graphics().setDepth(VISUAL_METRICS.hudDepth);

    this.timeText = scene.add
      .text(28, 21, '', {
        color: visualHex('textMain'),
        fontFamily: VISUAL_FONT.mono,
        fontSize: '18px',
        fontStyle: 'bold',
      })
      .setDepth(VISUAL_METRICS.hudDepth + 1);

    this.cashText = scene.add
      .text(250, 21, '', {
        color: visualHex('textMain'),
        fontFamily: VISUAL_FONT.mono,
        fontSize: '18px',
        fontStyle: 'bold',
      })
      .setDepth(VISUAL_METRICS.hudDepth + 1);

    this.barryText = scene.add
      .text(545, 21, '', {
        color: visualHex('paperOld'),
        fontFamily: VISUAL_FONT.mono,
        fontSize: '16px',
        fontStyle: 'bold',
      })
      .setDepth(VISUAL_METRICS.hudDepth + 1);

    this.debtText = scene.add
      .text(1000, 21, '', {
        color: visualHex('mustard'),
        fontFamily: VISUAL_FONT.mono,
        fontSize: '17px',
        fontStyle: 'bold',
      })
      .setDepth(VISUAL_METRICS.hudDepth + 1);

    this.statusText = scene.add
      .text(28, 67, '', {
        color: visualHex('textMuted'),
        fontFamily: VISUAL_FONT.sans,
        fontSize: '14px',
      })
      .setDepth(VISUAL_METRICS.hudDepth + 1);

    this.needTexts = Array.from({ length: 4 }, (_, index) =>
      scene.add
        .text(28, 150 + index * 82, '', {
          color: visualHex('textMain'),
          fontFamily: VISUAL_FONT.mono,
          fontSize: '15px',
          fontStyle: 'bold',
        })
        .setDepth(VISUAL_METRICS.hudDepth + 1),
    );
  }

  public render(state: GameState): void {
    const hud = deriveHudSnapshot(state, this.config);
    const graphics = this.graphics;
    graphics.clear();

    graphics.fillStyle(visualColor('inkPanel'), 0.99);
    graphics.fillRoundedRect(14, 10, 1252, 92, 16);
    graphics.lineStyle(2, visualColor('lineDirty'), 1);
    graphics.strokeRoundedRect(14, 10, 1252, 92, 16);

    graphics.fillStyle(visualColor('inkRaised'), 1);
    graphics.fillRoundedRect(232, 15, 285, 40, 11);
    graphics.lineStyle(1, visualColor('lineDirty'), 1);
    graphics.strokeRoundedRect(232, 15, 285, 40, 11);

    graphics.fillStyle(visualColor('inkRaised'), 1);
    graphics.fillRoundedRect(528, 15, 430, 40, 11);
    graphics.lineStyle(2, visualColor('rust'), 0.78);
    graphics.strokeRoundedRect(528, 15, 430, 40, 11);

    graphics.fillStyle(visualColor('inkRaised'), 1);
    graphics.fillRoundedRect(974, 15, 278, 40, 11);
    graphics.lineStyle(2, visualColor('mustard'), 0.68);
    graphics.strokeRoundedRect(974, 15, 278, 40, 11);

    graphics.fillStyle(visualColor('inkPanel'), 0.97);
    graphics.fillRoundedRect(14, 120, 230, 380, 18);
    graphics.lineStyle(2, visualColor('lineDirty'), 1);
    graphics.strokeRoundedRect(14, 120, 230, 380, 18);

    graphics.fillStyle(visualColor('paperOld'), 0.13);
    graphics.fillRect(24, 130, 210, 5);

    this.timeText.setText(
      `ДЕНЬ ${hud.day}   ${hud.time}`,
    );
    this.cashText.setText(
      `ДЕНЬГИ  ${hud.cash.toLocaleString('ru-RU')} ₽`,
    );
    this.barryText.setText(
      hud.minutesUntilBarry === 0
        ? `БАРРИ СЕЙЧАС · ${hud.nextBarry.toLocaleString('ru-RU')} ₽`
        : `БАРРИ ${formatBarryCountdown(
            hud.minutesUntilBarry,
          )} · ${hud.nextBarry.toLocaleString('ru-RU')} ₽`,
    );
    this.debtText.setText(
      `67М  ${hud.mainDebt.toLocaleString('ru-RU')} ₽`,
    );
    this.statusText.setText(
      hud.statuses.length > 0
        ? `СТАТУС: ${hud.statuses.join(', ')}`
        : 'СТАТУС: НЕТ',
    );

    hud.needs.forEach((need, index) => {
      const y = 176 + index * 82;
      const normalized = Math.max(
        0,
        Math.min(1, need.value / this.config.needs.max),
      );
      const width = 178;
      const low =
        need.value <= this.config.needs.lowThreshold;

      this.needTexts[index]?.setText(
        `${need.label}  ${Math.round(need.value)}`,
      );

      graphics.fillStyle(visualColor('inkRaised'), 1);
      graphics.fillRoundedRect(28, y, width, 14, 7);
      graphics.lineStyle(
        1,
        low
          ? visualColor('warning')
          : visualColor('lineDirty'),
        0.85,
      );
      graphics.strokeRoundedRect(28, y, width, 14, 7);

      graphics.fillStyle(
        low
          ? visualColor('warning')
          : visualColor('good'),
        1,
      );
      graphics.fillRoundedRect(
        28,
        y,
        width * normalized,
        14,
        7,
      );

      if (low) {
        graphics.fillStyle(visualColor('warning'), 0.18);
        graphics.fillRoundedRect(24, y - 12, 186, 42, 10);
      }
    });
  }
}
