import Phaser from 'phaser';

import type { BalanceConfig } from '../../config/balance.schema';
import type { GameState } from '../../core/state/GameState';
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
    this.graphics = scene.add.graphics().setDepth(500);

    this.timeText = scene.add
      .text(28, 21, '', {
        color: '#f4f6f8',
        fontFamily: 'ui-monospace, monospace',
        fontSize: '18px',
        fontStyle: 'bold',
      })
      .setDepth(501);

    this.cashText = scene.add
      .text(245, 21, '', {
        color: '#f4f6f8',
        fontFamily: 'ui-monospace, monospace',
        fontSize: '18px',
        fontStyle: 'bold',
      })
      .setDepth(501);

    this.barryText = scene.add
      .text(510, 21, '', {
        color: '#f0c78d',
        fontFamily: 'ui-monospace, monospace',
        fontSize: '16px',
      })
      .setDepth(501);

    this.debtText = scene.add
      .text(985, 21, '', {
        color: '#f4f6f8',
        fontFamily: 'ui-monospace, monospace',
        fontSize: '17px',
        fontStyle: 'bold',
      })
      .setDepth(501);

    this.statusText = scene.add
      .text(28, 67, '', {
        color: '#b8c1cc',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
      })
      .setDepth(501);

    this.needTexts = Array.from({ length: 4 }, (_, index) =>
      scene.add
        .text(28, 150 + index * 82, '', {
          color: '#f4f6f8',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '15px',
          fontStyle: 'bold',
        })
        .setDepth(501),
    );
  }

  public render(state: GameState): void {
    const hud = deriveHudSnapshot(state, this.config);
    const graphics = this.graphics;
    graphics.clear();

    graphics.fillStyle(0x11151a, 0.98);
    graphics.fillRoundedRect(14, 10, 1252, 92, 16);
    graphics.lineStyle(2, 0x303943, 1);
    graphics.strokeRoundedRect(14, 10, 1252, 92, 16);

    graphics.fillStyle(0x11151a, 0.96);
    graphics.fillRoundedRect(14, 120, 230, 380, 18);
    graphics.lineStyle(2, 0x303943, 1);
    graphics.strokeRoundedRect(14, 120, 230, 380, 18);

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
      `ДОЛГ  ${hud.mainDebt.toLocaleString('ru-RU')} ₽`,
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

      this.needTexts[index]?.setText(
        `${need.label}  ${Math.round(need.value)}`,
      );
      graphics.fillStyle(0x252c34, 1);
      graphics.fillRoundedRect(28, y, width, 14, 7);
      graphics.fillStyle(
        need.value <= this.config.needs.lowThreshold
          ? 0xb65b52
          : 0x708b73,
        1,
      );
      graphics.fillRoundedRect(
        28,
        y,
        width * normalized,
        14,
        7,
      );
    });
  }
}
