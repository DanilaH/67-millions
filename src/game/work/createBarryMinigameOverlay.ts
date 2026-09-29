import Phaser from 'phaser';

import type { BalanceConfig } from '../../config/balance.schema';
import { getBarryPaymentDue } from '../../core/barry/barry';
import type { GameState } from '../../core/state/GameState';
import { BARRY_CONTENT } from '../content/contentCatalog';

export interface BarryMinigameOverlay {
  show(state: GameState): void;
  hide(): void;
  setMessage(message: string): void;
}

export const createBarryMinigameOverlay = (
  scene: Phaser.Scene,
  config: BalanceConfig,
  onPay: () => void,
): BarryMinigameOverlay => {
  const { width, height } = scene.scale;
  const container = scene.add
    .container(0, 0)
    .setDepth(10_000)
    .setVisible(false);

  const shade = scene.add
    .rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x050607,
      0.82,
    )
    .setInteractive();

  const panel = scene.add
    .rectangle(
      width / 2,
      height / 2,
      560,
      280,
      0x171b20,
      1,
    )
    .setStrokeStyle(4, 0x7f5f4d, 1);

  const title = scene.add
    .text(
      width / 2,
      height / 2 - 100,
      `${BARRY_CONTENT.dueTitle} · 09:00`,
      {
      color: '#f4f6f8',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '30px',
      fontStyle: 'bold',
      },
    )
    .setOrigin(0.5);

  const dueText = scene.add
    .text(width / 2, height / 2 - 35, '', {
      color: '#f0c78d',
      fontFamily: 'ui-monospace, monospace',
      fontSize: '22px',
    })
    .setOrigin(0.5);

  const message = scene.add
    .text(
      width / 2,
      height / 2 + 12,
      BARRY_CONTENT.dueBody,
      {
        color: '#c7ced7',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '17px',
      },
    )
    .setOrigin(0.5);

  const pay = scene.add
    .text(width / 2, height / 2 + 72, '[ ЗАПЛАТИТЬ БАРРИ ]', {
      color: '#f4f6f8',
      backgroundColor: '#5b3a2d',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      padding: { x: 14, y: 10 },
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .on('pointerup', onPay);

  container.add([shade, panel, title, dueText, message, pay]);

  return {
    show: (state) => {
      dueText.setText(
        `Нужно: ${getBarryPaymentDue(
          state,
          config,
        ).toLocaleString('ru-RU')} ₽   /   Есть: ${state.cash.toLocaleString('ru-RU')} ₽`,
      );
      message.setText(BARRY_CONTENT.dueBody);
      container.setVisible(true);
    },
    hide: () => {
      container.setVisible(false);
    },
    setMessage: (value) => {
      message.setText(value);
    },
  };
};
