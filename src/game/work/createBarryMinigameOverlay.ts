import { balance } from '../../config/balance';
import Phaser from 'phaser';
import { addProductionImage, productionArtKey } from '../visual/productionArt';

import type { BalanceConfig } from '../../config/balance.schema';
import { getBarryPaymentDue } from '../../core/barry/barry';
import type { GameState } from '../../core/state/GameState';
import { BARRY_CONTENT } from '../content/contentCatalog';
import { VISUAL_FONT, VISUAL_METRICS, visualColor, visualHex } from '../visual/visualTheme';

export interface BarryMinigameOverlay {
  show(state: GameState): void;
  showPaid(amount: number, cash: number): void;
  hide(): void;
  setMessage(message: string): void;
}

export const createBarryMinigameOverlay = (
  scene: Phaser.Scene,
  config: BalanceConfig,
  onPay: () => void,
): BarryMinigameOverlay => {
  const width = balance.plinko.geometry.logicalViewportWidth;
  const height = balance.plinko.geometry.logicalViewportHeight;
  const container = scene.add
    .container(0, 0)
    .setDepth(VISUAL_METRICS.barryDepth)
    .setVisible(false);

  const shade = scene.add
    .rectangle(
      width / 2,
      height / 2,
      width,
      height,
      visualColor('inkDeep'),
      0.82,
    )
    .setInteractive();

  const panel = scene.add
    .rectangle(
      width / 2,
      height / 2,
      720,
      320,
      visualColor('inkPanel'),
      1,
    )
    .setStrokeStyle(4, visualColor('rust'), 1);

  const title = scene.add
    .text(
      width / 2,
      height / 2 - 100,
      `${BARRY_CONTENT.dueTitle} · 09:00`,
      {
      color: visualHex('textMain'),
      fontFamily: VISUAL_FONT.sans,
      fontSize: '30px',
      fontStyle: 'bold',
      },
    )
    .setOrigin(0.5);

  const dueText = scene.add
    .text(width / 2, height / 2 - 35, '', {
      color: visualHex('paperOld'),
      fontFamily: VISUAL_FONT.mono,
      fontSize: '22px',
    })
    .setOrigin(0.5);

  const message = scene.add
    .text(
      width / 2,
      height / 2 + 12,
      BARRY_CONTENT.dueBody,
      {
        color: visualHex('textMuted'),
        fontFamily: VISUAL_FONT.sans,
        fontSize: '17px',
        wordWrap: { width: 500 },
        align: 'center',
        lineSpacing: 3,
      },
    )
    .setOrigin(0.5);

  const pay = scene.add
    .text(width / 2, height / 2 + 72, '[ ЗАПЛАТИТЬ БАРРИ ]', {
      color: visualHex('textMain'),
      backgroundColor: visualHex('rust'),
      fontFamily: VISUAL_FONT.sans,
      fontSize: '20px',
      padding: { x: 14, y: 10 },
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .on('pointerup', onPay);

  const portrait = addProductionImage(scene, 'barry-due', width / 2 - 500, height / 2, 260, 266);
  container.add([shade, portrait, panel, title, dueText, message, pay]);

  return {
    show: (state) => {
      title.setText(`${BARRY_CONTENT.dueTitle} · 09:00`);
      pay.setText('[ ЗАПЛАТИТЬ БАРРИ ]');
      portrait.setTexture(productionArtKey('barry-due')).setDisplaySize(260, 266);
      dueText.setText(
        `Нужно: ${getBarryPaymentDue(
          state,
          config,
        ).toLocaleString('ru-RU')} ₽\nЕсть: ${state.cash.toLocaleString('ru-RU')} ₽`,
      );
      message.setText(BARRY_CONTENT.dueBody);
      container.setVisible(true);
    },
    showPaid: (amount, cash) => {
      title.setText('БАРРИ ЗАБРАЛ ЕЖЕДНЕВНЫЙ ПЛАТЁЖ');
      dueText.setText(`Списано: ${amount.toLocaleString('ru-RU')} ₽\nОсталось: ${cash.toLocaleString('ru-RU')} ₽`);
      message.setText('Барри дождался завершения шаров. Основной долг в 67 млн ₽ не уменьшился.');
      pay.setText('[ ПРОДОЛЖИТЬ ]');
      portrait.setTexture(productionArtKey('barry-paid')).setDisplaySize(260, 266);
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
